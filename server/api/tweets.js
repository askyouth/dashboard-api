'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const NotFoundError = Boom.notFound

const internals = {}

internals.dependencies = ['hapi-io', 'database']

internals.applyRoutes = (server, next) => {
  const Database = server.plugins.database
  const Tweet = Database.model('Tweet')

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
          if (maxId) qb.andWhere('id', '<', maxId)
          if (userId) qb.andWhere('user_id', '=', userId)
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
