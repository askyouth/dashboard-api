'use strict'

// Module dependencies.
const Joi = require('joi')
const Path = require('path')
const Uuid = require('node-uuid')
const Config = require('config')
const Promise = require('bluebird')
const BlobStore = require('fs-blob-store')

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
    return new Promise((resolve, reject) => {
      let key = Uuid.v1()
      options.name && (key = `${key}-${options.name}`)
      let ws = blobs.createWriteStream(key)
      ws.on('error', reject)
      rs.pipe(ws)
      rs.on('end', (err) => {
        if (err) return reject(err)
        resolve({
          key: key,
          url: url(key),
          filename: path(key)
        })
      })
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
