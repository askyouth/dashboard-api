'use strict'

// Module dependencies.
const Joi = require('joi')

const internals = {}

internals.applyRoutes = function (server, next) {
  const Database = server.plugins.database
  const Topic = Database.model('Topic')

  server.route({
    method: 'GET',
    path: '/topics',
    config: {
      description: 'Get topics',
      validate: {
        query: {
          page: Joi.number().integer().default(1),
          pageSize: Joi.number().integer().default(20),
          sort: Joi.string().valid(['name']).default('name'),
          sortOrder: Joi.string().valid(['asc', 'desc']).default('asc')
        }
      }
    },
    handler (request, reply) {
      let page = request.query.page
      let pageSize = request.query.pageSize
      let sort = request.query.sort
      let sortOrder = request.query.sortOrder

      let topics = Topic.forge()
        .orderBy(sort, sortOrder)
        .fetchPage({
          page: page,
          pageSize: pageSize
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

      let topic = Topic.forge(payload).save()

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

      topic = topic.save(payload)

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

  next()
}

exports.register = function (server, options, next) {
  server.dependency(['database'], internals.applyRoutes)
  next()
}

exports.register.attributes = {
  name: 'api/topics',
  dependecies: ['database']
}
