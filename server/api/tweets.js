'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Promise = require('bluebird')
const NotFoundError = Boom.notFound
const BadRequestError = Boom.badRequest

const internals = {}

internals.dependencies = ['hapi-io', 'database', 'services/twitter', 'services/file']

internals.applyRoutes = (server, next) => {
  const Database = server.plugins.database
  const Tweet = Database.model('Tweet')
  const Infographic = Database.model('Infographic')
  const File = server.plugins['services/file']
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
      validate: {
        query: {
          maxId: Joi.string(),
          userId: Joi.string(),
          topicId: Joi.number().integer(),
          limit: Joi.number().integer().default(20)
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
      let socket = request.plugins['hapi-io'].socket

      let tweets = Tweet.collection()
        .query((qb) => {
          if (maxId) qb.andWhere('tweet.id', '<', maxId)
          if (userId) qb.andWhere('tweet.user_id', '=', userId)
          if (topicId) {
            qb.innerJoin('tweet_topic', 'tweet.id', 'tweet_topic.tweet_id')
            qb.groupBy('tweet.id')
            qb.where('tweet_topic.topic_id', topicId)
          }
          qb.limit(limit)
        })
        .orderBy('created_at', 'desc')
        .fetch()

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
      payload: {
        output: 'stream',
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
          let stream = request.payload.file
          if (!stream) return reply()
          let file = File.create(stream, { name: stream.hapi.filename })
          reply(file)
        }
      }, {
        assign: 'infographic',
        method (request, reply) {
          let infographicId = request.payload.infographicId
          if (!infographicId) return reply()
          let infographic = Infographic.forge({ id: infographicId }).fetch()
          reply(infographic)
        }
      }]
    },
    handler (request, reply) {
      let text = request.payload.text
      let replyStatusId = request.payload.replyStatusId
      let file = request.pre.file || {}
      let infographic = request.pre.infographic
      let filename = file.filename || (infographic && File.path(infographic.get('name')))

      let tweet = Promise.resolve(filename).then(() => {
        if (filename) return Twitter.upload(filename)
      }).then((media) => Twitter.statusUpdate({
        status: text,
        in_reply_to_status_id: replyStatusId,
        media_ids: media && media.media_id_string
      }))

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
