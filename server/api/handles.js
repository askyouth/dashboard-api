'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')

exports.register = function (server, options, next) {
  const Twitter = server.plugins['services/twitter']
  const Database = server.plugins['services/database']
  const Topics = server.plugins['modules/topic']
  const Handles = server.plugins['modules/handle']

  const Topic = Database.model('Topic')
  const Handle = Database.model('Handle')

  function loadHandle (request, reply) {
    let handleId = request.params.handleId
    let handle = Handle.forge({ id: handleId })
      .fetch({ require: true })
      .catch(Handle.NotFoundError, () => Boom.notFound('Handle not found'))

    reply(handle)
  }

  function loadTopic (request, reply) {
    let topicId = request.params.topicId
    let topic = Topic.forge({ id: topicId })
      .fetch({ require: true })
      .catch(Topic.NotFoundError, () => Boom.notFound('Topic not found'))

    reply(topic)
  }

  server.route({
    method: 'GET',
    path: '/handles',
    config: {
      description: 'Get list of handles',
      validate: {
        query: {
          filter: Joi.object({
            search: Joi.string(),
            camp: Joi.number().integer(),
            topic: Joi.number().integer()
          }).default({}),
          page: Joi.number().integer().default(1),
          pageSize: Joi.number().integer().default(20),
          sort: Joi.string().valid(['name', 'created_at', 'klout_score']).default('name'),
          sortOrder: Joi.string().valid(['asc', 'desc']).default('asc'),
          related: Joi.array().items(Joi.string().valid(['topics'])).default([])
        }
      }
    },
    handler (request, reply) {
      let filter = request.query.filter
      let page = request.query.page
      let pageSize = request.query.pageSize
      let sort = request.query.sort
      let sortOrder = request.query.sortOrder
      let related = ['camp'].concat(request.query.related)

      let result = Promise.props({
        handles: Handles.fetch(filter, {
          sortBy: sort,
          sortOrder: sortOrder,
          page: page,
          pageSize: pageSize,
          withRelated: related
        }),
        count: Handles.count(filter)
      })

      reply(result)
    }
  })

  server.route({
    method: 'POST',
    path: '/handles',
    config: {
      description: 'Create new handle',
      validate: {
        payload: {
          username: Joi.string().required(),
          camp_id: Joi.number().integer(),
          follow: Joi.boolean().default(true)
        }
      },
      pre: [{
        assign: 'handle',
        method (request, reply) {
          let username = request.payload.username

          let handle = Handle.forge({ username })
            .fetch({ require: true })
            .then((handle) => Boom.badRequest('Handle already exist'))
            .catch(Handle.NotFoundError, () => {})

          reply(handle)
        }
      }]
    },
    handler (request, reply) {
      let username = request.payload.username
      let campId = request.payload.camp_id
      let follow = request.payload.follow

      let opts = {
        screen_name: username,
        include_entities: false
      }
      let handle = Twitter.getUserProfile(opts)
        .then((profile) => Handles.createFromTwitterProfile(profile, campId))
        .then((handle) => handle.refresh({ withRelated: ['camp'] }))
        .tap((handle) => Handles.addToTwitterList(handle))
        .tap((handle) => Twitter.follow(handle.get('id')))
        .tap((handle) => {
          if (follow) return Twitter.friendshipCreate(handle.get('id'))
        })

      reply(handle)
    }
  })

  server.route({
    method: 'GET',
    path: '/handles/{handleId}',
    config: {
      description: 'Get handle',
      validate: {
        params: {
          handleId: Joi.string().required()
        },
        query: {
          related: Joi.array().items(Joi.string().valid(['topics'])).default([])
        }
      },
      pre: [{
        method: loadHandle, assign: 'handle'
      }]
    },
    handler (request, reply) {
      let handle = request.pre.handle
      let related = ['camp'].concat(request.query.related)

      handle = handle.load(related)

      reply(handle)
    }
  })

  server.route({
    method: 'PUT',
    path: '/handles/{handleId}',
    config: {
      description: 'Update handle',
      validate: {
        params: {
          handleId: Joi.string().required()
        },
        payload: {
          name: Joi.string(),
          username: Joi.string(),
          profile: Joi.object(),
          camp_id: Joi.number().integer()
        }
      },
      pre: [{
        method: loadHandle, assign: 'handle'
      }]
    },
    handler (request, reply) {
      let payload = request.payload
      let handle = request.pre.handle

      handle = handle.save(payload)
        .then((handle) => handle.refresh({ withRelated: ['camp'] }))

      reply(handle)
    }
  })

  server.route({
    method: 'DELETE',
    path: '/handles/{handleId}',
    config: {
      description: 'Delete handle',
      validate: {
        params: {
          handleId: Joi.string().required()
        }
      },
      pre: [{
        method: loadHandle, assign: 'handle'
      }]
    },
    handler (request, reply) {
      let handle = request.pre.handle

      let handleId = handle.get('id')
      let promise = Handles.removeFromTwitterList(handle)
        .then(() => handle.destroy())
        .tap(() => Twitter.unfollow(handleId))
        .tap(() => Twitter.friendshipDestroy(handleId))

      reply(promise).code(204)
    }
  })

  server.route({
    method: 'POST',
    path: '/handles/{handleId}/follow',
    config: {
      description: 'Follow user on Twitter',
      pre: [{
        method: loadHandle, assign: 'handle'
      }]
    },
    handler (request, reply) {
      let handle = request.pre.handle
      let promise = Twitter.friendshipCreate(handle.get('id')).return(handle)

      reply(promise)
    }
  })

  server.route({
    method: 'POST',
    path: '/handles/{handleId}/unfollow',
    config: {
      description: 'Unfollow user on Twitter',
      pre: [{
        method: loadHandle, assign: 'handle'
      }]
    },
    handler (request, reply) {
      let handle = request.pre.handle
      let promise = Twitter.friendshipDestroy(handle.get('id')).return(handle)

      reply(promise)
    }
  })

  server.route({
    method: 'GET',
    path: '/handles/{handleId}/topics',
    config: {
      description: 'Get topics related to handle',
      validate: {
        params: {
          handleId: Joi.string().required()
        },
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
      },
      pre: [{
        method: loadHandle, assign: 'handle'
      }]
    },
    handler (request, reply) {
      let handle = request.pre.handle
      let page = request.query.page
      let pageSize = request.query.pageSize
      let sort = request.query.sort
      let sortOrder = request.query.sortOrder
      let related = request.query.related
      let filter = Object.assign({
        handle: handle.get('id')
      }, request.query.filter)

      let result = Promise.props({
        topics: Topics.fetch(filter, {
          sortBy: sort,
          sortOrder: sortOrder,
          page: page,
          pageSize: pageSize,
          withRelated: related
        }),
        count: Topics.count(filter)
      })

      reply(result)
    }
  })

  server.route({
    method: 'POST',
    path: '/handles/{handleId}/topics/{topicId}',
    config: {
      description: 'Attach topic to handle',
      validate: {
        params: {
          handleId: Joi.string().required(),
          topicId: Joi.number().integer().required()
        }
      },
      pre: [
        { method: loadHandle, assign: 'handle' },
        { method: loadTopic, assign: 'topic' }
      ]
    },
    handler (request, reply) {
      let handle = request.pre.handle
      let topic = request.pre.topic

      topic = handle.topics().attach(topic).return(topic)

      reply(topic)
    }
  })

  server.route({
    method: 'DELETE',
    path: '/handles/{handleId}/topics/{topicId}',
    config: {
      description: 'Detach topic from handle',
      validate: {
        params: {
          handleId: Joi.string().required(),
          topicId: Joi.number().integer().required()
        }
      },
      pre: [
        { method: loadHandle, assign: 'handle' },
        { method: loadTopic, assign: 'topic' }
      ]
    },
    handler (request, reply) {
      let handle = request.pre.handle
      let topic = request.pre.topic

      let topics = handle
        .related('topics')
        .query({ where: { topic_id: topic.get('id') } })
        .fetch()
        .then((topics) => {
          let topic = topics.shift()
          if (!topic) {
            throw Boom.badRequest('Topic not attached')
          }
          return handle.topics().detach(topic)
        })

      reply(topics).code(204)
    }
  })

  next()
}

exports.register.attributes = {
  name: 'api/handles',
  dependencies: [
    'services/twitter',
    'services/database',
    'modules/topic',
    'modules/handle'
  ]
}

module.exports = Deputy(exports)
