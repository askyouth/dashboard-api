'use strict'

// Module dependencies.
const Joi = require('joi')
const Twitter = require('./client')
const TwitterStream = require('node-tweet-stream')
const TwitterUploadStream = require('./upload-stream')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')
const _ = require('lodash')

Promise.promisifyAll(Twitter.prototype)

const MAX_USERS = 5000
const MAX_KEYWORDS = 400

const internals = {}

exports.validate = {
  schema: {
    auth: Joi.object({
      consumer_key: Joi.string().required(),
      consumer_secret: Joi.string().required(),
      access_token: Joi.string().required(),
      access_token_secret: Joi.string().required()
    }).required()
  },
  message: 'Invalid Twitter configuration'
}

exports.register = function (server, options, next) {
  const IO = server.plugins['hapi-io'].io
  const Database = server.plugins['services/database']
  const Topics = server.plugins['modules/topic']
  const Contributions = server.plugins['modules/contribution']

  const Tweet = Database.model('Tweet')
  const Topic = Database.model('Topic')
  const Handle = Database.model('Handle')
  const log = server.log.bind(server, ['services', 'twitter'])

  const twitter = new Twitter({
    consumer_key: options.auth.consumer_key,
    consumer_secret: options.auth.consumer_secret,
    access_token_key: options.auth.access_token,
    access_token_secret: options.auth.access_token_secret
  })
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
    storeTweet(internals.transform(tweet))
      .then((tweet) => [
        tweet,
        Topics.process(tweet),
        Contributions.process(tweet)
      ])
      .spread(broadcast)
      .catch((err) => log(`error: ${err.message}`))
  }

  function storeTweet (tweet) {
    return Tweet.forge(tweet)
      .save(null, { method: 'insert' })
  }

  function broadcast (tweet, topics, contribution) {
    tweet = tweet.toJSON()
    IO.in('timeline').emit('tweets:new', tweet)
    IO.in(`handle:${tweet.user_id}`).emit('tweets:new', tweet)
    topics.forEach((topic) => IO.in(`topic:${topic.id}`).emit('tweets:new', tweet))
    if (contribution) {
      IO.in(`contribution:${contribution.id}`).emit('tweets:new', tweet)
    }
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
    log(`following ${handles}`)
    stream.follow(handles, false)
    reconnect()
  }

  function unfollow (handles) {
    log(`unfollowing ${handles}`)
    stream.unfollow(handles, false)
    reconnect()
  }

  function verifyCredentials (opts) {
    opts = Object.assign({
      skip_status: true,
      include_entities: false
    }, opts)
    return twitter.getAsync('account/verify_credentials', opts)
  }

  function getUserProfile (opts) {
    return twitter.getAsync('users/show', opts)
  }

  function statusUpdate (opts) {
    return twitter.postAsync('statuses/update', opts)
  }

  function statusRetweet (id) {
    return twitter.postAsync(`statuses/retweet/${id}`)
  }

  function statusFavorite (id) {
    return twitter.postAsync('favorites/create', { id: id })
  }

  function statusUnfavorite (id) {
    return twitter.postAsync('favorites/destroy', { id: id })
  }

  function upload (stream, opts) {
    return Promise.fromCallback((cb) => {
      let upload = new TwitterUploadStream(twitter, opts, cb)
      stream.pipe(upload).on('error', cb)
    })
  }

  function listOwnerships () {
    return getUsingCursor('lists/ownerships', {}, 'lists')
  }

  function listMembers (opts) {
    opts = Object.assign({
      count: 50
    }, opts)
    return getUsingCursor('lists/members', opts, 'users')
  }

  function listAddMember (id, userId) {
    return twitter.postAsync('lists/members/create', {
      list_id: id,
      user_id: userId
    })
  }

  function listRemoveMember (id, userId) {
    return twitter.postAsync('lists/members/destroy', {
      list_id: id,
      user_id: userId
    })
  }

  function friendshipCreate (id) {
    return twitter.postAsync('friendships/create', { user_id: id })
  }

  function friendshipDestroy (id) {
    return twitter.postAsync('friendships/destroy', { user_id: id })
  }

  function getUsingCursor (path, params, prop) {
    let data = []
    let done = function (result) {
      Array.prototype.push.apply(data, result[prop])
      if (result.next_cursor_str === '0') return data
      params.cursor = result.next_cursor_str
      return twitter.getAsync(path, params).then(done)
    }
    return twitter.getAsync(path, params).then(done)
  }

  server.expose('track', track)
  server.expose('untrack', untrack)
  server.expose('follow', follow)
  server.expose('unfollow', unfollow)
  server.expose('verifyCredentials', verifyCredentials)
  server.expose('getUserProfile', getUserProfile)
  server.expose('statusUpdate', statusUpdate)
  server.expose('statusRetweet', statusRetweet)
  server.expose('statusFavorite', statusFavorite)
  server.expose('statusUnfavorite', statusUnfavorite)
  server.expose('upload', upload)
  server.expose('listOwnerships', listOwnerships)
  server.expose('listMembers', listMembers)
  server.expose('listAddMember', listAddMember)
  server.expose('listRemoveMember', listRemoveMember)
  server.expose('friendshipCreate', friendshipCreate)
  server.expose('friendshipDestroy', friendshipDestroy)

  server.expose('TwitterError', Twitter.TwitterError)

  Promise.join(
    Topic.collection().fetch(),
    Handle.collection().fetch()
  ).spread((topics, handles) => {
    let users = handles.pluck('id').slice(0, MAX_USERS)
    let keywords = topics.pluck('keywords')
      .reduce((memo, keywords) => memo.concat(keywords), [])
      .concat(handles.pluck('username').map((username) => `@${username}`))
      .slice(0, MAX_KEYWORDS)

    log(`following ${users.length} users and ${keywords.length} keywords`)

    users.length && follow(users)
    keywords.length && track(keywords)

    reconnect()
  }).nodeify(next)
}

internals.transform = (tweet) => ({
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
    profile_image_url: `https://twitter.com/${tweet.user.screen_name}/profile_image?size=original`,
    profile_avatar_url: `https://twitter.com/${tweet.user.screen_name}/profile_image?size=normal`,
    verified: tweet.user.verified,
    created_at: new Date(tweet.user.created_at)
  },
  favorited: tweet.favorited,
  retweeted: tweet.retweeted,
  entities: Object.assign(tweet.entities, {
    user_mentions: _.map(tweet.entities.user_mentions, (user) => ({
      id: user.id_str,
      name: user.name,
      screen_name: user.screen_name
    }))
  }),
  extended_entities: tweet.extended_entities,
  parent_id: tweet.in_reply_to_status_id_str,
  in_reply_to_user_id: tweet.in_reply_to_user_id_str,
  in_reply_to_screen_name: tweet.in_reply_to_screen_name,
  created_at: new Date(tweet.created_at)
})

exports.register.attributes = {
  name: 'services/twitter',
  dependencies: [
    'hapi-io',
    'services/database',
    'modules/topic',
    'modules/contribution'
  ]
}

module.exports = Deputy(exports)
