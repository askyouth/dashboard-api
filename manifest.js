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
    plugin: 'hapi-io'
  }, {
    plugin: 'hapi-auth-jwt2'
  }, {
    plugin: {
      register: './server/services/database',
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
      register: './server/services/mail',
      options: Config.getp('mail')
    }
  }, {
    plugin: {
      register: './server/services/auth',
      options: {
        secret: Config.get('auth.secret')
      }
    }
  }, {
    plugin: {
      register: './server/services/file',
      options: Config.getp('files')
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
    plugin: './server/modules/settings'
  }, {
    plugin: './server/modules/user'
  }, {
    plugin: './server/modules/tweet'
  }, {
    plugin: './server/modules/handle'
  }, {
    plugin: './server/modules/topic'
  }, {
    plugin: './server/modules/contribution'
  }, {
    plugin: './server/api/auth'
  }, {
    plugin: './server/api/account'
  }, {
    plugin: './server/api/users'
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
    plugin: './server/api/settings'
  }]
}

const store = new Confidence.Store(manifest)

exports.get = (key) => store.get(key, criteria)
exports.meta = (key) => store.meta(key, criteria)
