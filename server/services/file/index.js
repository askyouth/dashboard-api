'use strict'

// Module dependencies.
const Joi = require('joi')
const Uuid = require('node-uuid')
const Config = require('config')
const Promise = require('bluebird')

exports.register = function (server, options, next) {
  const schema = {
    store: Joi.string().required().allow(['directory', 's3']),
    directory: Joi.string(),
    access_key: Joi.string(),
    secret_key: Joi.string(),
    bucket: Joi.string()
  }

  try {
    Joi.assert(options, schema, 'Invalid upload configuration')
  } catch (err) {
    return next(err)
  }

  let blobs
  if (options.store === 's3') {
    blobs = new (require('./s3-file-store'))(options)
  } else if (options.store === 'directory') {
    options.baseUrl = `${Config.get('connection.api.uri')}/uploads`
    blobs = new (require('./local-file-store'))(options)
  }

  function fetch (key) {
    return blobs.createReadStream(key)
  }

  function create (rs, options) {
    return Promise.fromCallback((cb) => {
      let key = Uuid.v1()
      options.name && (key = `${key}-${options.name}`)
      let ws = blobs.createWriteStream(key, cb)
      rs.pipe(ws)
    })
  }

  function remove (options) {
    return Promise.fromCallback((cb) => {
      blobs.remove(options, cb)
    })
  }

  server.expose('fetch', fetch)
  server.expose('create', create)
  server.expose('remove', remove)

  next()
}

exports.register.attributes = {
  name: 'services/file'
}
