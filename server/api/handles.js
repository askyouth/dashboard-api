'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Promise = require('bluebird')

const NotFoundError = Boom.notFound
const BadRequestError = Boom.badRequest

const internals = {}

internals.dependencies = [
  'database',
  'services/handle',
  'services/twitter',
  'services/klout'
]

internals.applyRoutes = (server, next) => {
  const Klout = server.plugins['services/klout']
  const Twitter = server.plugins['services/twitter']
  const HandleService = server.plugins['services/handle']
  const Database = server.plugins.database
  const Handle = Database.model('Handle')
  const Topic = Database.model('Topic')

  function loadHandle (request, reply) {
    let handleId = request.params.handleId
    let handle = Handle.forge({ id: handleId })
      .fetch({ require: true })
      .catch(Handle.NotFoundError, () => {
        throw NotFoundError('Topic not found')
      })

    reply(handle)
  }

  function loadTopic (request, reply) {
    let topicId = request.params.topicId
    let topic = Topic.forge({ id: topicId })
      .fetch({ require: true })
      .catch(Topic.NotFoundError, () => {
        throw NotFoundError('Topic not found')
      })

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

      let handles = HandleService.fetch(filter, {
        sortBy: sort,
        sortOrder: sortOrder,
        page: page,
        pageSize: pageSize,
        withRelated: related
      })

      reply(handles)
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
          camp_id: Joi.number().integer()
        }
      },
      pre: [{
        assign: 'handle',
        method (request, reply) {
          let username = request.payload.username

          let handle = Handle.forge({ username })
            .fetch({ require: true })
            .then((handle) => {
              throw new BadRequestError('Handle already exist')
            })
            .catch(Handle.NotFoundError, () => {})

          reply(handle)
        }
      }]
    },
    handler (request, reply) {
      let username = request.payload.username
      let campId = request.payload.camp_id

      let handle = Promise.join(
        Twitter.getUserProfile({
          screen_name: username,
          include_entities: false
        }),
        Klout.getIdentity(username).catch((err) => {
          if (err.message.match(/not found/i)) return {}
          throw err
        })
      ).spread((twitterProfile, kloutIdentity) => {
        return Handle.forge({
          id: twitterProfile.id_str,
          username: twitterProfile.screen_name,
          name: twitterProfile.name,
          profile: {
            image: twitterProfile.profile_image_url_https,
            description: twitterProfile.description
          },
          camp_id: campId,
          klout_id: kloutIdentity.id
        }).save(null, { method: 'insert' })
      }).tap((handle) => {
        Twitter.follow(handle.get('id'))
      }).then((handle) => handle.refresh({ withRelated: ['camp'] }))

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
      let promise = handle.destroy().then(() => {
        Twitter.unfollow(handleId)
      })

      reply(promise).code(204)
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
        }
      },
      pre: [{
        method: loadHandle, assign: 'handle'
      }]
    },
    handler (request, reply) {
      let handle = request.pre.handle
      let topics = handle.related('topics').fetch()

      reply(topics)
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
            throw new BadRequestError('Topic not attached')
          }
          return handle.topics().detach(topic)
        })

      reply(topics).code(204)
    }
  })

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.applyRoutes)
  next()
}

exports.register.attributes = {
  name: 'api/handles',
  dependencies: internals.dependencies
}
