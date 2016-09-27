'use strict'

// Module dependencies.
const Lab = require('lab')
const Code = require('code')
const Hapi = require('hapi')
const Knex = require('knex')
const Config = require('config')
const Promise = require('bluebird')
const Manifest = require('../../manifest')
const Errors = require('../../server/errors')
const Database = require('../../server/database')
const Twitter = require('../../server/services/twitter')
const Handles = require('../../server/api/handles')

const lab = exports.lab = Lab.script()
let db
let server

function initServer (plugins) {
  return Promise.fromCallback((cb) => {
    server = new Hapi.Server()
    server.connection({
      port: Config.get('connection.api.port')
    })
    server.register(plugins, (err) => {
      if (err) return cb(err)
      server.initialize(cb)
    })
  })
}

const handles = [
  { uid: '123', username: 'test1', name: 'Test One', profile: {} },
  { uid: '456', username: 'test2', name: 'Test Two', profile: {} }
]

const topics = [
  { name: 'Topic One' },
  { name: 'Topic Two' },
  { name: 'Topic Three' }
]

function initDatabase () {
  db = Knex(Config.get('database.knex'))
  return db.migrate.latest().then(() => {
    return Promise.all([
      db('handle').insert(handles).returning('id'),
      db('topic').insert(topics).returning('id')
    ])
  }).spread((handleIds, topicIds) => {
    handles[0].id = handleIds[0]
    handles[1].id = handleIds[1]
    topics[0].id = topicIds[0]
    topics[1].id = topicIds[1]
    handles[0].topics = [topics[0], topics[1]]
    handles[1].topics = [topics[0]]

    return db('handle_topic').insert([
      { handle_id: handles[0].id, topic_id: handles[0].topics[0].id },
      { handle_id: handles[0].id, topic_id: handles[0].topics[1].id },
      { handle_id: handles[1].id, topic_id: handles[1].topics[0].id }
    ])
  })
}

function destroyDatabase () {
  return db.migrate.rollback()
}

function getOptions (name) {
  return Manifest.get('/registrations').filter((reg) => {
    return (reg.plugin && reg.plugin.register && reg.plugin.register === name)
  })[0].plugin.options
}

lab.before(() => {
  const DatabasePlugin = {
    register: Database,
    options: getOptions('./server/database')
  }
  const TwitterPlugin = {
    register: Twitter,
    options: getOptions('./server/services/twitter')
  }
  const plugins = [Errors, DatabasePlugin, TwitterPlugin, Handles]
  return Promise.all([initDatabase(), initServer(plugins)])
})

lab.after(() => destroyDatabase())

lab.experiment('Handles result list', () => {
  lab.test('it returns array of documents successfully', () => {
    let request = {
      method: 'GET',
      url: '/handles'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result).to.be.an.array().and.have.length(2)
      Code.expect(result[0].uid).to.equal(handles[0].uid)
    })
  })

  lab.test('it returns array of documents by page successfully', () => {
    let request = {
      method: 'GET',
      url: '/handles?page=2&pageSize=1'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result).to.be.an.array().and.have.length(1)
      Code.expect(result[0].uid).to.equal(handles[1].uid)
    })
  })

  lab.test('it returns array of document with related fields', () => {
    let request = {
      method: 'GET',
      url: '/handles?related=["topics"]'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result).to.be.an.array().and.have.length(2)
      Code.expect(result[0].topics).to.be.an.array().and.have.length(2)
    })
  })
})

lab.experiment('Handles create', () => {
  lab.test('it creates new handle successfully', () => {
    let handle = {
      username: 'djelich'
    }
    let request = {
      method: 'POST',
      url: '/handles',
      payload: handle
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      return db('handle').where({ id: result.id }).select()
    }).then((handles) => {
      Code.expect(handles).to.be.an.array().and.have.length(1)
      Code.expect(handles[0].username).to.equal(handle.username)
    })
  })
})

lab.experiment('Handle get', () => {
  lab.test('it returns document', () => {
    let request = {
      method: 'GET',
      url: '/handles/1'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result.uid).to.equal(handles[0].uid)
      Code.expect(result.username).to.equal(handles[0].username)
    })
  })

  lab.test('it returns error when topic does not exists', () => {
    let request = {
      method: 'GET',
      url: '/handles/200'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(404)
    })
  })

  lab.test('it returns document with related fields', () => {
    let request = {
      method: 'GET',
      url: '/handles/1?related=["topics"]'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result.uid).to.equal(handles[0].uid)
      Code.expect(result.topics).to.be.an.array().and.have.length(2)
      Code.expect(result.topics[0].name).to.equal(handles[0].topics[0].name)
      Code.expect(result.topics[1].name).to.equal(handles[0].topics[1].name)
    })
  })

  lab.test('it returns error when fetching invalid relations', () => {
    let request = {
      method: 'GET',
      url: '/handles/1?related=["missing"]'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(400)
      let result = JSON.parse(response.payload)
      Code.expect(result.message).to.match(/child "related" fails/)
    })
  })
})

lab.experiment('Handle update', () => {
  lab.test('it updates and returns document', () => {
    let handle = {
      name: 'New Name'
    }
    let request = {
      method: 'PUT',
      url: '/handles/1',
      payload: handle
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      return db('handle').where({ id: 1 }).select()
    }).then((handles) => {
      Code.expect(handles).to.be.an.array().and.have.length(1)
      Code.expect(handles[0].name).to.equal(handle.name)
    })
  })
})

lab.experiment('Handle delete', () => {
  lab.test('it deletes handle successfully', () => {
    let request = {
      method: 'DELETE',
      url: '/handles/1'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(204)
      Code.expect(response.payload).to.equal('')
      return db('handle').where({ id: 1 }).select()
    }).then((handles) => {
      Code.expect(handles).to.be.an.array().and.have.length(0)
    })
  })
})

lab.experiment('Handle related topics', () => {
  lab.test('it returns array of related topics', () => {
    let request = {
      method: 'GET',
      url: '/handles/2/topics'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result).to.be.an.array().and.have.length(1)
      Code.expect(result[0].name).to.equal(handles[1].topics[0].name)
    })
  })
})

lab.experiment('Handle attach topic', () => {
  lab.test('it adds topic to handle', () => {
    let request = {
      method: 'POST',
      url: '/handles/2/topics/2'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      return db('handle_topic').where({ handle_id: 2 }).select()
    }).then((handleTopics) => {
      Code.expect(handleTopics).to.be.an.array().and.have.length(2)
    })
  })

  lab.test('it returns error if topic is already attached', () => {
    let request = {
      method: 'POST',
      url: '/handles/2/topics/1'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(400)
    })
  })

  lab.test('it returns error if topic does not exist', () => {
    let request = {
      method: 'POST',
      url: '/handles/2/topics/200'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(404)
    })
  })
})

lab.experiment('Handle detach topic', () => {
  lab.test('it removes topic from handle', () => {
    let request = {
      method: 'DELETE',
      url: '/handles/2/topics/1'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(204)
      return db('handle_topic').where({ handle_id: 2, topic_id: 1 }).select()
    }).then((topics) => {
      Code.expect(topics).to.be.an.array().and.have.length(0)
    })
  })

  lab.test('it returns error if topic is not attached', () => {
    let request = {
      method: 'DELETE',
      url: '/handles/2/topics/3'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(400)
      let result = JSON.parse(response.payload)
      Code.expect(result.message).to.match(/topic not attached/i)
    })
  })

  lab.test('it returns error if topic does not exists', () => {
    let request = {
      method: 'DELETE',
      url: '/handles/2/topics/200'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(404)
    })
  })
})
