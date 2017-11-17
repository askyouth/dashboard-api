'use strict'

// Module dependencies.
const Joi = require('joi')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')
const TwitterStream = require('node-tweet-stream')
const transformTweet = require('./transform')
const _ = require('lodash')

const MAX_USERS = 5000
const MAX_KEYWORDS = 400

exports.validate = {
  schema: {
    auth: Joi.object({
      consumer_key: Joi.string().required(),
      consumer_secret: Joi.string().required(),
      access_token: Joi.string().required(),
      access_token_secret: Joi.string().required()
    }).required()
  },
  message: 'Invalid Twitter Stream configuration'
}

exports.register = function (server, options, next) {
  const IO = server.plugins['hapi-io'].io
  const Database = server.plugins['services/database']
  const Topics = server.plugins['modules/topic']
  const Contributions = server.plugins['modules/contribution']

  const Tweet = Database.model('Tweet')
  const Topic = Database.model('Topic')
  const Handle = Database.model('Handle')
  const log = server.log.bind(server, ['services', 'twitter', 'stream'])

  const stream = new TwitterStream({
    consumer_key: options.auth.consumer_key,
    consumer_secret: options.auth.consumer_secret,
    token: options.auth.access_token,
    token_secret: options.auth.access_token_secret
  })
  stream.on('error', errorHandler)
  stream.on('tweet', tweetHandler)
  stream.on('connect', infoHandler('connect'))
  stream.on('reconnect', infoHandler('reconnect'))
  stream.on('disconnect', infoHandler('disconnect'))
  stream.on('warning', infoHandler('warning'))
  stream.on('limit', infoHandler('limit'))

  const reconnect = _.throttle(() => {
    let tracking = stream.tracking().length
    let following = stream.following().length

    log(`initiate reconnect: ${tracking} keywords and ${following} users`)

    stream.reconnect()
  }, 60 * 1000, {
    leading: false,
    trailing: true
  })

  init().catch((err) => log(`error init stream: ${err.message}`))

  function track (keywords) {
    let tracking = stream.tracking()
    let avail = MAX_KEYWORDS - tracking.length
    let toTrack = _(keywords).uniq().without(...tracking).slice(0, avail).value()

    log(`tracking ${toTrack.length}/${keywords.length} new keywords`)

    if (toTrack.length) {
      stream.track(toTrack, false)
      reconnect()
    }
  }

  function untrack (keywords) {
    let tracking = stream.tracking().length
    keywords.forEach((keyword) => stream.untrack(keyword, false))
    let untracked = tracking - stream.tracking().length

    log(`untracked ${untracked}/${keywords.length}`)

    if (untracked) {
      reconnect()
    }
  }

  function follow (handles) {
    let following = stream.following()
    let avail = MAX_USERS - following.length
    let toFollow = _(handles).uniq().without(...following).slice(0, avail).value()

    log(`following ${toFollow.length}/${handles.length} new handles`)

    if (toFollow.length) {
      stream.follow(toFollow, false)
      reconnect()
    }
  }

  function unfollow (handles) {
    let following = stream.following().length
    handles.forEach((handle) => stream.unfollow(handle, false))
    let unfollowed = following - stream.following().length

    log(`unfollowed ${unfollowed}/${handles.length} users`)

    if (unfollowed) {
      reconnect()
    }
  }

  async function init () {
    let [topics, handles] = await Promise.all([
      Topic.collection().query('whereNot', 'keywords', '{}').fetch(),
      Handle.collection().query('whereNot', 'camp_id', null).fetch()
    ])

    let users = handles.pluck('id')
    let keywords = topics.pluck('keywords')
        .reduce((memo, keywords) => memo.concat(keywords), [])
        .concat(handles.pluck('username').map((username) => `@${username}`))

    log(`loaded ${users.length} users and ${keywords.length} keywords from database`)

    users.length && follow(users)
    keywords.length && track(keywords)

    reconnect()
  }

  async function tweetHandler (data) {
    try {
      let tweet = await Tweet.forge(transformTweet(data))
          .save(null, { method: 'insert' })
      let [topics, contribution] = await Promise.all([
        Topics.process(tweet),
        Contributions.process(tweet)
      ])

      broadcast(tweet.toJSON(), topics, contribution && contribution.toJSON())
    } catch (err) {
      log(`error processing tweet: ${err.message}`)
    }
  }

  function broadcast (tweet, topics, contribution) {
    IO.in('timeline').emit('tweets:new', tweet)
    IO.in(`handle:${tweet.user_id}`).emit('tweets:new', tweet)
    topics.forEach((topic) => IO.in(`topic:${topic}`).emit('tweets:new', tweet))
    if (contribution) {
      IO.in(`contribution:${contribution.id}`).emit('tweets:new', tweet)
    }
  }

  function errorHandler (err) {
    log(`error: ${err.message}`)
  }

  function infoHandler (type) {
    return function () {
      let args = [...arguments]
      log(`${type}: ${JSON.stringify(args)}`)
    }
  }

  server.expose('track', track)
  server.expose('untrack', untrack)
  server.expose('follow', follow)
  server.expose('unfollow', unfollow)

  next()
}

exports.register.attributes = {
  name: 'services/twitter/stream',
  dependencies: [
    'hapi-io',
    'services/database',
    'modules/topic',
    'modules/contribution'
  ]
}

module.exports = Deputy(exports)
