'use strict'

// Module dependencies.
const Joi = require('joi')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')

exports.register = function (server, options, next) {
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

exports.register.attributes = {
  name: 'api/search',
  dependencies: [
    'modules/tweet',
    'modules/topic',
    'modules/handle'
  ]
}

module.exports = Deputy(exports)
