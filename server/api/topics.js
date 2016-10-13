'use strict'

// Module dependencies.
const Joi = require('joi')

const internals = {}

internals.dependencies = ['database', 'services/twitter']

internals.applyRoutes = function (server, next) {
  const Twitter = server.plugins['services/twitter']
  const Database = server.plugins.database
  const Topic = Database.model('Topic')

  server.route({
    method: 'GET',
    path: '/topics',
    config: {
      description: 'Get topics',
      validate: {
        query: {
          filter: Joi.object({
            search: Joi.string()
          }).default({}),
          page: Joi.number().integer().default(1),
          pageSize: Joi.number().integer().default(20),
          sort: Joi.string().valid(['name']).default('name'),
          sortOrder: Joi.string().valid(['asc', 'desc']).default('asc'),
          related: Joi.array().items(Joi.string().valid(['handles'])).default([])
        }
      }
    },
    handler (request, reply) {
      let filter = request.query.filter
      let page = request.query.page
      let pageSize = request.query.pageSize
      let sort = request.query.sort
      let sortOrder = request.query.sortOrder
      let related = request.query.related

      let topics = Topic
        .query((qb) => {
          if (filter.search) {
            qb.where(function () {
              this.where('topic.name', 'ilike', `%${filter.search}%`)
                .orWhere('topic.description', 'ilike', `%${filter.search}%`)
            })
          }
        })
        .orderBy(sort, sortOrder)
        .fetchPage({
          page: page,
          pageSize: pageSize,
          withRelated: related
        })

      reply(topics)
    }
  })

  server.route({
    method: 'POST',
    path: '/topics',
    config: {
      description: 'Create topic',
      validate: {
        payload: {
          name: Joi.string().required(),
          description: Joi.string(),
          keywords: Joi.array().items(Joi.string())
        }
      }
    },
    handler (request, reply) {
      let payload = request.payload

      let topic = Topic.forge(payload).save().tap((topic) => {
        if (topic.get('keywords').length) {
          Twitter.track(topic.get('keywords'))
        }
      })

      reply(topic)
    }
  })

  function loadTopic (request, reply) {
    let topicId = request.params.topicId
    let topic = Topic.forge({ id: topicId })
      .fetch({ require: true })

    reply(topic)
  }

  server.route({
    method: 'GET',
    path: '/topics/{topicId}',
    config: {
      description: 'Get topic',
      validate: {
        params: {
          topicId: Joi.number().integer().required()
        },
        query: {
          related: Joi.array().items(Joi.string().valid(['handles'])).default([])
        }
      },
      pre: [
        { method: loadTopic, assign: 'topic' }
      ]
    },
    handler (request, reply) {
      let topic = request.pre.topic
      let related = request.query.related

      if (related.length) {
        topic = topic.load(related)
      }

      reply(topic)
    }
  })

  server.route({
    method: 'PUT',
    path: '/topics/{topicId}',
    config: {
      description: 'Update topic',
      validate: {
        params: {
          topicId: Joi.number().integer().required()
        },
        payload: {
          name: Joi.string(),
          description: Joi.string().allow(null),
          keywords: Joi.array().items(Joi.string())
        }
      },
      pre: [
        { method: loadTopic, assign: 'topic' }
      ]
    },
    handler (request, reply) {
      let topic = request.pre.topic
      let payload = request.payload

      topic.set(payload)

      let previousKeywords = topic.previous('keywords')
      let hasChangedKeywords = topic.hasChanged('keywords')

      topic = topic.save().tap((topic) => {
        if (hasChangedKeywords) {
          if (previousKeywords.length) {
            Twitter.untrack(previousKeywords)
          }
          if (topic.get('keywords').length) {
            Twitter.track(topic.get('keywords'))
          }
        }
      })

      reply(topic)
    }
  })

  server.route({
    method: 'DELETE',
    path: '/topics/{topicId}',
    config: {
      description: 'Remove topic',
      validate: {
        params: {
          topicId: Joi.number().integer().required()
        }
      },
      pre: [
        { method: loadTopic, assign: 'topic' }
      ]
    },
    handler (request, reply) {
      let topic = request.pre.topic

      topic = topic.destroy().return()

      reply(topic).code(204)
    }
  })

  server.route({
    method: 'GET',
    path: '/topics/{topicId}/handles',
    config: {
      description: 'Get handles related to topic',
      validate: {
        params: {
          topicId: Joi.number().integer().required()
        }
      },
      pre: [{
        method: loadTopic, assign: 'topic'
      }]
    },
    handler (request, reply) {
      let topic = request.pre.topic
      let handles = topic.related('handles').fetch()

      reply(handles)
    }
  })

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.applyRoutes)
  next()
}

exports.register.attributes = {
  name: 'api/topics',
  dependecies: internals.dependencies
}
