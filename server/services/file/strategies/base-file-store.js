'use strict'

// Module dependencies.
const Path = require('path')
const Uuid = require('node-uuid')
const Mime = require('mime-types')

class BaseFileStore {
  generateKey (opts) {
    let key = Uuid.v1()
    if (opts.type) {
      key = `${key}.${Mime.extension(opts.type)}`
    } else if (opts.name) {
      key = `${key}${Path.extname(opts.name)}`
    }
    return key
  }
}

module.exports = BaseFileStore
