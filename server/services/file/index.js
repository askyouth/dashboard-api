'use strict'

// Module dependencies.
const Joi = require('joi')
const Path = require('path')
const Uuid = require('node-uuid')
const Config = require('config')
const Promise = require('bluebird')
const BlobStore = require('fs-blob-store')
const StreamLength = require('./stream-length')

Promise.promisifyAll(BlobStore.prototype)

exports.register = function (server, options, next) {
  const schema = {
    directory: Joi.string().required()
  }

  try {
    Joi.assert(options, schema, 'Invalid upload configuration')
  } catch (err) {
    return next(err)
  }

  const blobs = new BlobStore(options.directory)
  const baseUrl = Config.get('connection.api.uri')

  function path (key) {
    return Path.join(options.directory, key)
  }

  function url (key) {
    return `${baseUrl}/uploads/${key}`
  }

  function create (rs, options) {
    return Promise.fromCallback((cb) => {
      let key = Uuid.v1()
      options.name && (key = `${key}-${options.name}`)
      let ls = new StreamLength()
      let ws = blobs.createWriteStream(key, (err) => {
        if (err) return cb(err)
        cb(null, {
          key: key,
          url: url(key),
          filename: path(key),
          size: ls.length
        })
      })
      rs.pipe(ls).pipe(ws)
    })
  }

  function remove (options) {
    return blobs.removeAsync(options)
  }

  server.expose('url', url)
  server.expose('path', path)
  server.expose('create', create)
  server.expose('remove', remove)

  next()
}

exports.register.attributes = {
  name: 'services/file'
}
