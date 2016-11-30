'use strict'

// Module dependencies.
const Joi = require('joi')
const Promise = require('bluebird')

const internals = {}

internals.dependencies = [
  'services/tweet',
  'services/topic',
  'services/handle'
]

internals.applyRoutes = (server, next) => {
  const Tweet = server.plugins['services/tweet']
  const Topic = server.plugins['services/topic']
  const Handle = server.plugins['services/handle']

  server.route({
    method: 'GET',
    path: '/search',
    config: {
      description: 'Search everything',
      validate: {
        query: {
          q: Joi.string().required()
        }
      }
    },
    handler (request, reply) {
      let q = request.query.q

      let result = Promise.props({
        tweets: Tweet.fetch({ search: q }, { limit: 5 }),
        topics: Topic.fetch({ search: q }, { pageSize: 5 }),
        handles: Handle.fetch({ search: q }, { pageSize: 5 })
      })

      reply(result)
    }
  })

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.applyRoutes)
  next()
}

exports.register.attributes = {
  name: 'api/search',
  dependencies: internals.dependencies
}
