'use strict'

// Module dependencies.
const Joi = require('joi')
const Promise = require('bluebird')

exports.register = function (server, options, next) {
  const schema = {
    strategy: Joi.string().required().allow(['local', 's3']),
    directory: Joi.string().when('strategy', { is: 'local', then: Joi.required() }),
    base_url: Joi.string().when('strategy', { is: 'local', then: Joi.required() }),
    access_key: Joi.string().when('strategy', { is: 's3', then: Joi.required() }),
    secret_key: Joi.string().when('strategy', { is: 's3', then: Joi.required() }),
    bucket: Joi.string().when('strategy', { is: 's3', then: Joi.required() })
  }

  try {
    Joi.assert(options, schema, 'Invalid upload configuration')
  } catch (err) {
    return next(err)
  }

  const strategy = options.strategy
  const store = new (require(`./strategies/${strategy}-file-store`))(options)

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
