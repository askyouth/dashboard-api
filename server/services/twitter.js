'use strict'

// Module dependencies.
const Twitter = require('twit')
const Promise = require('bluebird')

Twitter.prototype.getAsync = Promise.promisify(Twitter.prototype.get)
Twitter.prototype.postAsync = Promise.promisify(Twitter.prototype.post)

exports.register = function (server, options, next) {
  const twitter = new Twitter(options.auth)

  function getUserProfile (opts) {
    return twitter.getAsync('users/show', opts)
  }

  server.expose('getUserProfile', getUserProfile)

  next()
}

exports.register.attributes = {
  name: 'services/twitter'
}
