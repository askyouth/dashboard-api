'use strict'

// Module dependencies.
const Joi = require('joi')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')

exports.validate = {
  schema: {
    strategy: Joi.string().required().allow(['local', 's3']),
    directory: Joi.string().when('strategy', { is: 'local', then: Joi.required() }),
    base_url: Joi.string().when('strategy', { is: 'local', then: Joi.required() }),
    access_key: Joi.string().when('strategy', { is: 's3', then: Joi.required() }),
    secret_key: Joi.string().when('strategy', { is: 's3', then: Joi.required() }),
    bucket: Joi.string().when('strategy', { is: 's3', then: Joi.required() })
  },
  message: 'Invalid file store configuration'
}

exports.register = function (server, options, next) {
  const store = new (require(`./strategies/${options.strategy}-file-store`))(options)

  function fetch (key) {
    return store.createReadStream(key)
  }

  function create (rs, opts) {
    return Promise.fromCallback((cb) => {
      rs.pipe(store.createWriteStream(opts, cb))
    })
  }

  function remove (opts) {
    return Promise.fromCallback((cb) => {
      store.remove(opts, cb)
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

module.exports = Deputy(exports)
