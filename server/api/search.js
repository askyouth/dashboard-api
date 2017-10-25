'use strict'

// Module dependencies.
const Joi = require('joi')
const Promise = require('bluebird')

const internals = {}

internals.dependencies = [
  'modules/tweet',
  'modules/topic',
  'modules/handle'
]

internals.applyRoutes = (server, next) => {
  const Tweets = server.plugins['modules/tweet']
  const Topics = server.plugins['modules/topic']
  const Handles = server.plugins['modules/handle']

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
        tweets: Tweets.fetch({ search: q }, { limit: 5 }),
        topics: Topics.fetch({ search: q }, { pageSize: 5 }),
        handles: Handles.fetch({ search: q }, { pageSize: 5 })
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
