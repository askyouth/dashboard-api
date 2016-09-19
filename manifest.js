'use strict'

// Module dependencies.
const Confidence = require('confidence')

let criteria = {
  env: process.env.NODE_ENV
}

let manifest = {
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
    port: process.env.PORT || 4000,
    uri: process.env.API_URI,
    labels: ['api'],
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
  }]
}

let store = new Confidence.Store(manifest)

exports.get = (key) => store.get(key, criteria)
exports.meta = (key) => store.meta(key, criteria)
