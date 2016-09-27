'use strict'

// Module dependencies.
const Lab = require('lab')
const Code = require('code')
const Hapi = require('hapi')
const Knex = require('knex')
const Config = require('config')
const Promise = require('bluebird')
const Manifest = require('../../manifest')
const Database = require('../../server/database')
const Topics = require('../../server/api/topics')

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

const topics = [
  { name: 'Topic 1', description: 'topic about number one', keywords: ['foo'] },
  { name: 'Topic 2', description: 'topic about number two', keywords: ['bar'] }
]

function initDatabase () {
  db = Knex(Config.get('database.knex'))
  return db.migrate.latest().then(() => {
    let data = topics.map((row) => Object.assign({}, row, {
      keywords: JSON.stringify(row.keywords)
    }))
    return db('topic').insert(data)
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
  const plugins = [DatabasePlugin, Topics]
  return Promise.all([
    initDatabase(),
    initServer(plugins)
  ])
})

lab.after(() => destroyDatabase())

lab.experiment('Topics result list', () => {
  lab.test('it returns array of documents successfully', () => {
    let request = {
      method: 'GET',
      url: '/topics'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result).to.be.an.array().and.have.length(2)
      Code.expect(result[0].name).to.equal(topics[0].name)
      Code.expect(result[1].name).to.equal(topics[1].name)
      Code.expect(result[0].keywords).to.equal(topics[0].keywords)
      Code.expect(result[1].keywords).to.equal(topics[1].keywords)
    })
  })

  lab.test('it returns array of documents by page successfully', () => {
    let request = {
      method: 'GET',
      url: '/topics?page=2&pageSize=1'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result).to.be.an.array().and.have.length(1)
      Code.expect(result[0].name).to.equal(topics[1].name)
      Code.expect(result[0].description).to.equal(topics[1].description)
    })
  })
})

lab.experiment('Topics create', () => {
  lab.test('it creates new topic successfully', () => {
    let topic = {
      name: 'Topic 3',
      description: 'topic about number 3',
      keywords: ['foo', 'bar', 'baz']
    }
    let request = {
      method: 'POST',
      url: '/topics',
      payload: topic
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      return db('topic').where({ id: result.id }).select()
    }).then((topics) => {
      Code.expect(topics).to.be.an.array().and.have.length(1)
      Code.expect(topics[0].id).to.equal(3)
      Code.expect(topics[0].name).to.equal(topic.name)
      Code.expect(topics[0].description).to.equal(topic.description)
      Code.expect(topics[0].keywords).to.equal(topic.keywords)
    })
  })
})

lab.experiment('Topic get', () => {
  lab.test('it returns document', () => {
    let request = {
      method: 'GET',
      url: '/topics/1'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result.id).to.equal(1)
      Code.expect(result.name).to.equal(topics[0].name)
    })
  })

  lab.test('it returns document with related fields', () => {
    let request = {
      method: 'GET',
      url: '/topics/1?related=["handles"]'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      let result = JSON.parse(response.payload)
      Code.expect(result.id).to.equal(1)
      Code.expect(result.name).to.equal(topics[0].name)
      Code.expect(result.handles).to.be.an.array().and.have.length(0)
    })
  })

  lab.test('it returns error when fetching invalid relations', () => {
    let request = {
      method: 'GET',
      url: '/topics/1?related=["missing"]'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(400)
      let result = JSON.parse(response.payload)
      Code.expect(result.message).to.match(/child "related" fails/)
    })
  })
})

lab.experiment('Topic update', () => {
  lab.test('it updates and returns document', () => {
    let topic = {
      name: 'Topic x',
      description: 'topic about letter x',
      keywords: ['new', 'keywords']
    }
    let request = {
      method: 'PUT',
      url: '/topics/1',
      payload: topic
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(200)
      return db('topic').where({ id: 1 }).select()
    }).then((topics) => {
      Code.expect(topics).to.be.an.array().and.have.length(1)
      Code.expect(topics[0].name).to.equal(topic.name)
      Code.expect(topics[0].description).to.equal(topic.description)
      Code.expect(topics[0].keywords).to.equal(topic.keywords)
    })
  })
})

lab.experiment('Topic delete', () => {
  lab.test('it deletes topic successfully', () => {
    let request = {
      method: 'DELETE',
      url: '/topics/1'
    }

    return server.inject(request).then((response) => {
      Code.expect(response.statusCode).to.equal(204)
      Code.expect(response.payload).to.equal('')
      return db('topic').where({ id: 1 }).select()
    }).then((topic) => {
      Code.expect(topic).to.be.an.array().and.have.length(0)
    })
  })
})
