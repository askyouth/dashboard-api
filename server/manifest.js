'use strict'

// Module dependencies.
const Config = require('config')
const Confidence = require('confidence')
const Package = require('../package.json')

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
      register: 'hapi-swagger',
      options: {
        info: {
          title: '#ASK Dashboard API documentation',
          version: Package.version
        },
        securityDefinitions: {
          jwt: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header'
          }
        },
        jsonEditor: true,
        documentationPath: '/'
      }
    }
  }, {
    plugin: 'hapi-io'
  }, {
    plugin: 'hapi-auth-jwt2'
  }, {
    plugin: {
      register: './services/database',
      options: {
        knex: Config.getp('database.knex'),
        models: {
          Camp: 'models/camp',
          Contribution: 'models/contribution',
          Handle: 'models/handle',
          Infographic: 'models/infographic',
          KloutScore: 'models/klout_score',
          Session: 'models/session',
          Settings: 'models/settings',
          Topic: 'models/topic',
          Tweet: 'models/tweet',
          User: 'models/user'
        },
        baseModel: 'models/_base',
        plugins: ['pagination', 'virtuals', 'visibility']
      }
    }
  }, {
    plugin: {
      register: './services/mail',
      options: Config.getp('mail')
    }
  }, {
    plugin: {
      register: './services/auth',
      options: {
        secret: Config.get('auth.secret')
      }
    }
  }, {
    plugin: {
      register: './services/file',
      options: Config.getp('files')
    }
  }, {
    plugin: {
      register: './services/klout',
      options: {
        auth: Config.get('klout.auth'),
        interval: Config.get('klout.interval')
      }
    }
  }, {
    plugin: {
      register: './services/twitter',
      options: {
        auth: Config.getp('twitter.auth')
      }
    }
  }, {
    plugin: {
      register: './services/twitter/stream',
      options: {
        auth: Config.getp('twitter.auth')
      }
    }
  }, {
    plugin: './services/twitter/metrics'
  }, {
    plugin: './modules/settings'
  }, {
    plugin: './modules/user'
  }, {
    plugin: './modules/tweet'
  }, {
    plugin: './modules/handle'
  }, {
    plugin: './modules/topic'
  }, {
    plugin: './modules/contribution'
  }, {
    plugin: './api/auth'
  }, {
    plugin: './api/account'
  }, {
    plugin: './api/users'
  }, {
    plugin: './api/handles'
  }, {
    plugin: './api/topics'
  }, {
    plugin: './api/tweets'
  }, {
    plugin: './api/contributions'
  }, {
    plugin: './api/infographics'
  }, {
    plugin: './api/analytics'
  }, {
    plugin: './api/search'
  }, {
    plugin: './api/settings'
  }]
}

const store = new Confidence.Store(manifest)

exports.get = (key) => store.get(key, criteria)
exports.meta = (key) => store.meta(key, criteria)
