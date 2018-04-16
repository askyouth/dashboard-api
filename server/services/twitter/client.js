'use strict'

// Module dependencies.
const Twitter = require('twitter')

class TwitterError extends Error {
  constructor (message, code) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    } else {
      this.stack = (new Error(message)).stack
    }
  }
}

class TwitterExtended extends Twitter {
  get (url, params, cb) {
    super.get(url, params, (err, result) => {
      if (err) return cb(new TwitterError(err[0].message, err[0].code))
      cb(null, result)
    })
  }
  post (url, params, cb) {
    super.post(url, params, (err, result) => {
      if (err) return cb(new TwitterError(err[0].message, err[0].code))
      cb(null, result)
    })
  }
}

module.exports = TwitterExtended
module.exports.TwitterError = TwitterError
