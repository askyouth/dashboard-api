'use strict'

// Module dependencies.
const Joi = require('joi')
const Knex = require('knex')
const Bookshelf = require('bookshelf')
const Path = require('path')

exports.register = (server, options, next) => {
  const log = server.log.bind(server, ['database'])

  let schema = Joi.object({
    knex: Joi.object().required(),
    models: Joi.object().required(),
    baseModel: Joi.string().optional(),
    plugins: Joi.array().items(Joi.string()).default([])
  })

  // validate options
  try {
    Joi.assert(options, schema, 'Invalid database configuration')
  } catch (err) {
    return next(err)
  }

  // initialize bookshelf
  log(`knex options: ${JSON.stringify(options.knex)}`)
  let bookshelf = Bookshelf(Knex(options.knex))

  // initialize plugins
  let plugins = ['registry'].concat(options.plugins)
  plugins.forEach((plugin) => {
    log(`register plugin: ${plugin}`)
    bookshelf.plugin(plugin)
  })

  // load base model
  let baseModel = bookshelf.Model.extend({})
  if (options.baseModel) {
    log(`load base model from ${options.baseModel}`)
    baseModel = load(options.baseModel)(bookshelf)
  }

  // load models
  Object.keys(options.models).forEach((model) => {
    let file = options.models[model]
    log(`register model ${model} from ${file}`)
    bookshelf.model(model, load(file)(baseModel))
  })

  function load (module) {
    return require(Path.resolve(__dirname, module))
  }

  server.on('stop', () => bookshelf.knex.destroy())

  // expose plugin
  server.expose(bookshelf)

  next()
}

exports.register.attributes = {
  name: 'database'
}
