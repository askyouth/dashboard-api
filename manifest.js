'use strict'

// Module dependencies.
const Config = require('config')
const Confidence = require('confidence')

// hack to return POJO
const proto = Object.getPrototypeOf(Config)
proto.getp = function (path) {
  return JSON.parse(JSON.stringify(this.get(path)))
}

const criteria = {
  env: process.env.NODE_ENV
}

const manifest = {
  $meta: 'This file defines dashboard server.',
  server: {
    debug: {
      request: ['error']
    },
    load: {
      sampleInterval: 1000
    }
  },
  connections: [{
    port: Config.get('connection.api.port'),
    uri: Config.get('connection.api.uri'),
    labels: ['api'],
    routes: {
      cors: true
    },
    router: {
      stripTrailingSlash: true
    }
  }],
  registrations: [{
    plugin: 'hapi-io'
  }, {
    plugin: {
      register: 'good',
      options: {
        reporters: {
          console: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{
              ops: '*',
              log: '*',
              error: '*',
              request: '*',
              response: '*'
            }]
          }, {
            module: 'good-console'
          }, 'stdout']
        }
      }
    }
  }, {
    plugin: 'inert'
  }, {
    plugin: 'vision'
  }, {
    plugin: {
      register: 'lout',
      options: {
        endpoint: '/'
      }
    }
  }, {
    plugin: 'tv'
  }, {
    plugin: 'hapi-auth-jwt2'
  }, {
    plugin: {
      register: './server/auth',
      options: {
        secret: Config.get('auth.secret')
      }
    }
  }, {
    plugin: {
      register: './server/database',
      options: {
        knex: Config.getp('database.knex'),
        models: './server/database/models',
        baseModel: './server/database/models/_base',
        plugins: ['pagination', 'registry', 'virtuals', 'visibility']
      }
    }
  }, {
    plugin: './server/api/auth'
  }, {
    plugin: './server/api/account'
  }, {
    plugin: './server/api/handles'
  }, {
    plugin: './server/api/topics'
  }, {
    plugin: './server/api/tweets'
  }, {
    plugin: './server/api/contributions'
  }, {
    plugin: './server/api/infographics'
  }, {
    plugin: './server/api/analytics'
  }, {
    plugin: './server/api/search'
  }, {
    plugin: './server/services/tweet'
  }, {
    plugin: './server/services/handle'
  }, {
    plugin: './server/services/topic'
  }, {
    plugin: './server/services/contribution'
  }, {
    plugin: {
      register: './server/services/mail',
      options: Config.getp('mail')
    }
  }, {
    plugin: {
      register: './server/services/twitter',
      options: {
        auth: Config.getp('twitter.auth')
      }
    }
  }, {
    plugin: {
      register: './server/services/klout',
      options: {
        auth: Config.get('klout.auth'),
        interval: Config.get('klout.interval')
      }
    }
  }, {
    plugin: {
      register: './server/services/file',
      options: {
        directory: process.cwd() + '/public/uploads'
      }
    }
  }]
}

const store = new Confidence.Store(manifest)

exports.get = (key) => store.get(key, criteria)
exports.meta = (key) => store.meta(key, criteria)
