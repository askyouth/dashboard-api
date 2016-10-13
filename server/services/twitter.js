'use strict'

// Module dependencies.
const Joi = require('joi')
const Twitter = require('twit')
const TwitterStream = require('node-tweet-stream')
const Promise = require('bluebird')
const _ = require('lodash')

Twitter.prototype.getAsync = Promise.promisify(Twitter.prototype.get)
Twitter.prototype.postAsync = Promise.promisify(Twitter.prototype.post)

const internals = {}

internals.dependencies = ['hapi-io', 'database']

internals.init = function (server, twitter, options, next) {
  const IO = server.plugins['hapi-io'].io
  const Database = server.plugins.database
  const Tweet = Database.model('Tweet')
  const Topic = Database.model('Topic')
  const Handle = Database.model('Handle')
  const log = server.log.bind(server, ['services', 'twitter'])

  const stream = new TwitterStream({
    consumer_key: options.auth.consumer_key,
    consumer_secret: options.auth.consumer_secret,
    token: options.auth.access_token,
    token_secret: options.auth.access_token_secret
  })
  stream.on('error', errorHandler)
  stream.on('tweet', tweetHandler)

  const reconnect = _.throttle(() => {
    log('reconnect')
    stream.reconnect()
  }, 30 * 1000, {
    leading: false,
    trailing: true
  })

  function errorHandler (err) {
    log(`error: ${err.message}`)
  }

  function tweetHandler (tweet) {
    storeTweet(tweet)
      .then((tweet) => [tweet, processTopics(tweet)])
      .spread(broadcast)
      .catch((err) => log(`error: ${err.message}`))
  }

  function storeTweet (tweet) {
    return Tweet.forge({
      id: tweet.id_str,
      text: tweet.text,
      lang: tweet.lang,
      user_id: tweet.user.id_str,
      user: {
        id: tweet.user.id_str,
        name: tweet.user.name,
        screen_name: tweet.user.screen_name,
        location: tweet.user.location,
        url: tweet.user.url,
        description: tweet.user.description,
        profile_image_url: tweet.user.profile_image_url_https,
        verified: tweet.user.verified,
        created_at: new Date(tweet.user.created_at)
      },
      favorited: tweet.favorited,
      retweeted: tweet.retweeted,
      entities: tweet.entities,
      extended_entities: tweet.extended_entities,
      parent_id: tweet.in_reply_to_status_id_str,
      in_reply_to_user_id: tweet.in_reply_to_user_id_str,
      in_reply_to_screen_name: tweet.in_reply_to_screen_name,
      created_at: new Date(tweet.created_at)
    }).save(null, { method: 'insert' })
  }

  function processTopics (tweet) {
    return Topic
      .collection()
      .query('where', 'keywords', '!=', '{}')
      .fetch()
      .then((topics) => {
        let tokens = _.uniq(tweet.get('text').match(/\w+/g)).map(_.toLower)
        let matched = topics.filter((topic) => _.intersection(
          tokens,
          topic.get('keywords').map(_.toLower)
        ).length)

        if (!matched.length) return []
        return tweet.topics().attach(matched)
      })
  }

  function broadcast (tweet, topics) {
    tweet = tweet.toJSON()
    IO.in('timeline').emit('tweets:new', tweet)
    IO.in(`handle:${tweet.user_id}`).emit('tweets:new', tweet)
    topics.forEach((topic) => IO.in(`topic:${topic.id}`).emit('tweets:new', tweet))
  }

  function track (keywords) {
    log(`tracking ${keywords}`)
    stream.track(keywords, false)
    reconnect()
  }

  function untrack (keywords) {
    log(`untracking ${keywords}`)
    stream.untrack(keywords, false)
    reconnect()
  }

  function follow (handles) {
    log(`tracking ${handles}`)
    stream.follow(handles, false)
    reconnect()
  }

  function unfollow (handles) {
    log(`untracking ${handles}`)
    stream.unfollow(handles, false)
    reconnect()
  }

  server.expose('track', track)
  server.expose('untrack', untrack)
  server.expose('follow', follow)
  server.expose('unfollow', unfollow)

  Promise.join(
    Topic.collection().fetch(),
    Handle.collection().fetch()
  ).spread((topics, handles) => {
    topics = topics.pluck('keywords')
      .reduce((memo, keywords) => memo.concat(keywords), [])
    handles = handles.pluck('uid')

    topics.length && track(topics)
    handles.length && follow(handles)

    reconnect()
  }).nodeify(next)
}

exports.register = function (server, options, next) {
  const schema = Joi.object({
    auth: Joi.object({
      consumer_key: Joi.string().required(),
      consumer_secret: Joi.string().required(),
      access_token: Joi.string().required(),
      access_token_secret: Joi.string().required()
    }).required()
  })

  try {
    Joi.assert(options, schema, 'Invalid Twitter configuration')
  } catch (err) {
    return next(err)
  }

  const twitter = new Twitter(options.auth)

  function getUserProfile (opts) {
    return twitter.getAsync('users/show', opts)
  }

  server.expose('getUserProfile', getUserProfile)

  server.dependency(internals.dependencies, (server, next) => {
    internals.init(server, twitter, options, next)
  })

  next()
}

exports.register.attributes = {
  name: 'services/twitter',
  dependencies: internals.dependencies
}
