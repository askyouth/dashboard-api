'use strict'

// Module dependencies.
const Fs = require('fs')
const Joi = require('joi')
const Boom = require('boom')
const NotFoundError = Boom.notFound
const BadRequestError = Boom.badRequest

const internals = {}

internals.dependencies = [
  'hapi-io',
  'database',
  'services/tweet',
  'services/twitter',
  'services/file'
]

internals.applyRoutes = (server, next) => {
  const Database = server.plugins.database
  const Tweet = Database.model('Tweet')
  const Infographic = Database.model('Infographic')
  const File = server.plugins['services/file']
  const Tweets = server.plugins['services/tweet']
  const Twitter = server.plugins['services/twitter']

  function loadTweet (request, reply) {
    let tweetId = request.params.id
    let tweet = Tweet.forge({ id: tweetId })
      .fetch({ require: true })
      .catch(Tweet.NotFoundError, () => {
        throw new NotFoundError('Tweet not found')
      })

    reply(tweet)
  }

  server.route({
    method: 'GET',
    path: '/tweets',
    config: {
      description: 'Get tweets',
      auth: {
        mode: 'optional'
      },
      validate: {
        query: {
          maxId: Joi.string(),
          userId: Joi.string(),
          topicId: Joi.number().integer(),
          limit: Joi.number().integer().default(20),
          sortBy: Joi.string().default('created_at'),
          sortOrder: Joi.string().default('desc')
        },
        options: {
          allowUnknown: true
        }
      },
      plugins: {
        'hapi-io': 'tweets:fetch'
      }
    },
    handler (request, reply) {
      let maxId = request.query.maxId
      let userId = request.query.userId
      let topicId = request.query.topicId
      let limit = request.query.limit
      let sortBy = request.query.sortBy
      let sortOrder = request.query.sortOrder
      let withRelated = ['handle']

      let query = { maxId, userId, topicId }
      let opts = { limit, sortBy, sortOrder, withRelated }
      let tweets = Tweets.fetch(query, opts)

      let socket = request.plugins['hapi-io'].socket
      if (socket) {
        socket.leaveAll()
        if (userId) socket.join(`user:${userId}`)
        else if (topicId) socket.join(`topic:${topicId}`)
        else socket.join('timeline')
      }

      reply(tweets)
    }
  })

  server.route({
    method: 'POST',
    path: '/tweets',
    config: {
      description: 'Create new tweet',
      payload: {
        output: 'file',
        parse: true,
        maxBytes: 10 * 1024 * 1024,
        allow: 'multipart/form-data'
      },
      validate: {
        payload: {
          text: Joi.string().required(),
          replyStatusId: Joi.string(),
          infographicId: Joi.number().integer(),
          file: Joi.any()
        }
      },
      pre: [{
        assign: 'file',
        method (request, reply) {
          let file = request.payload.file
          if (!file) return reply()

          let stream = Fs.createReadStream(file.path)
          let media = Twitter.upload(stream, {
            mediaSize: file.bytes
          }).finally(() => {
            Fs.unlinkSync(file.path)
          })

          reply(media)
        }
      }, {
        assign: 'infographic',
        method (request, reply) {
          let infographicId = request.payload.infographicId
          if (!infographicId) return reply()

          let media = Infographic.forge({ id: infographicId })
            .fetch({ require: true })
            .then((infographic) => {
              let stream = File.fetch(infographic.get('name'))
              return Twitter.upload(stream, {
                mediaSize: infographic.get('file_size')
              })
            })

          reply(media)
        }
      }]
    },
    handler (request, reply) {
      let text = request.payload.text
      let replyStatusId = request.payload.replyStatusId
      let mediaId = request.pre.file || request.pre.infographic

      let tweet = Twitter.statusUpdate({
        status: text,
        in_reply_to_status_id: replyStatusId,
        media_ids: mediaId
      })

      reply(tweet)
    }
  })

  server.route({
    method: 'GET',
    path: '/tweets/{id}',
    config: {
      description: 'Fetch tweet',
      validate: {
        params: {
          id: Joi.string().required()
        }
      },
      plugins: {
        'hapi-io': 'tweets:get'
      },
      pre: [{
        method: loadTweet, assign: 'tweet'
      }]
    },
    handler (request, reply) {
      let tweet = request.pre.tweet
      tweet = tweet.load(['parent', 'replies'])

      reply(tweet)
    }
  })

  server.route({
    method: 'POST',
    path: '/tweets/{id}/retweet',
    config: {
      description: 'Retweet tweet',
      validate: {
        params: {
          id: Joi.string().required()
        }
      },
      pre: [{
        method: loadTweet, assign: 'tweet'
      }]
    },
    handler (request, reply) {
      let tweet = request.pre.tweet

      let promise = Twitter.statusRetweet(tweet.get('id'))
        .catch((err) => {
          // already retweeted
          if (err.code === 327) return
          // tweet deleted
          if (err.code === 144) {
            return tweet.destroy().then(() => {
              throw new BadRequestError('Tweet deleted')
            })
          }
        })
        .then(() => tweet.save({ retweeted: true }, { validate: false }))

      reply(promise)
    }
  })

  server.route({
    method: 'POST',
    path: '/tweets/{id}/favorite',
    config: {
      description: 'Add tweet to favorites',
      validate: {
        params: {
          id: Joi.string().required()
        }
      },
      pre: [{
        method: loadTweet, assign: 'tweet'
      }]
    },
    handler (request, reply) {
      let tweet = request.pre.tweet

      let promise = Twitter.statusFavorite(tweet.get('id'))
        .catch((err) => {
          // tweet deleted
          if (err.code === 144) {
            return tweet.destroy().then(() => {
              throw new BadRequestError('Tweet deleted')
            })
          }
        })
        .then(() => tweet.save({ favorited: true }, { validate: false }))

      reply(promise)
    }
  })

  server.route({
    method: 'POST',
    path: '/tweets/{id}/unfavorite',
    config: {
      description: 'Remove tweet from favorites',
      validate: {
        params: {
          id: Joi.string().required()
        }
      },
      pre: [{
        method: loadTweet, assign: 'tweet'
      }]
    },
    handler (request, reply) {
      let tweet = request.pre.tweet

      let promise = Twitter.statusUnfavorite(tweet.get('id'))
        .catch((err) => {
          // tweet deleted
          if (err.code === 144) {
            return tweet.destroy().then(() => {
              throw new BadRequestError('Tweet deleted')
            })
          }
        })
        .then(() => tweet.save({ favorited: false }, { validate: false }))

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
  name: 'api/interactions',
  dependencies: internals.dependencies
}
