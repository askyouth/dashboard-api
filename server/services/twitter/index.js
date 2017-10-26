'use strict'

// Module dependencies.
const Joi = require('joi')
const Twitter = require('./client')
const TwitterUploadStream = require('./upload-stream')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')

Promise.promisifyAll(Twitter.prototype)

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
  const twitter = new Twitter({
    consumer_key: options.auth.consumer_key,
    consumer_secret: options.auth.consumer_secret,
    access_token_key: options.auth.access_token,
    access_token_secret: options.auth.access_token_secret
  })

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

  next()
}

exports.register.attributes = {
  name: 'services/twitter'
}

module.exports = Deputy(exports)
