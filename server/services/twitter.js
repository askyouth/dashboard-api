'use strict'

// Module dependencies.
const Joi = require('joi')
const Twitter = require('twit')
const TwitterStream = require('node-tweet-stream')
const Promise = require('bluebird')

Twitter.prototype.getAsync = Promise.promisify(Twitter.prototype.get)
Twitter.prototype.postAsync = Promise.promisify(Twitter.prototype.post)

const internals = {}

internals.dependencies = ['hapi-io', 'database']

internals.init = function (server, twitter, options, next) {
  const IO = server.plugins['hapi-io'].io
  const Database = server.plugins.database
  const Tweet = Database.model('Tweet')
  const Handle = Database.model('Handle')
  const log = server.log.bind(server, ['services', 'twitter'])
  let stalled = false

  const stream = new TwitterStream({
    consumer_key: options.auth.consumer_key,
    consumer_secret: options.auth.consumer_secret,
    token: options.auth.access_token,
    token_secret: options.auth.access_token_secret
  })
  stream.on('error', errorHandler)
  stream.on('tweet', tweetHandler)

  function errorHandler (err) {
    log(`error: ${err.message}`)
  }

  function tweetHandler (tweet) {
    console.log('%s: %s', tweet.user.screen_name, tweet.text)
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
      .then((tweet) => IO.sockets.emit('tweets:new', tweet))
      .catch((err) => log(`error: ${err.message}`))
  }

  function follow (handles) {
    log(`tracking ${handles}`)
    stalled = true
    stream.follow(handles, false)
  }

  server.expose('follow', follow)

  function reconnect () {
    if (stalled) {
      stalled = false
      stream.reconnect()
    }
    setTimeout(reconnect, 1000)
  }

  Handle.collection().fetch().then((handles) => {
    let handleIds = handles.pluck('uid')
    follow(handleIds)
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
