'use strict'

// Module dependencies.
const Promise = require('bluebird')

const internals = {}

internals.dependencies = [
  'settings'
]

internals.applyRoutes = (server, next) => {
  const Settings = server.plugins.settings

  server.route({
    method: 'GET',
    path: '/settings',
    config: {
      description: 'Fetch settings'
    },
    handler (request, reply) {
      let settings = Promise.props({
        settings: Settings.get()
      })

      reply(settings)
    }
  })

  server.route({
    method: 'POST',
    path: '/settings',
    config: {
      description: 'Update settings'
    },
    handler (request, reply) {
      let settings = request.payload
      if (!settings || Object.keys(settings).length === 0) {
        return reply({})
      }
      let promise = Settings.set(settings)

      reply(promise)
    }
  })

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.applyRoutes)

  next()
}

exports.register.attributes = {
  name: 'api/settings',
  dependencies: internals.dependencies
}
