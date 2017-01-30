'use strict'

// Module dependencies.
const Joi = require('joi')
const Knex = require('knex')
const Bookshelf = require('bookshelf')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')

exports.register = (server, options, next) => {
  let schema = Joi.object({
    knex: Joi.object().required(),
    models: Joi.string().required(),
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
  let bookshelf = Bookshelf(Knex(options.knex))

  // initialize plugins
  options.plugins.forEach((plugin) => bookshelf.plugin(plugin))

  // load base model
  let baseModel
  if (options.baseModel) {
    baseModel = require(path.resolve(options.baseModel))(bookshelf)
  } else {
    baseModel = bookshelf.Model.extend({})
  }

  // load models
  let modelDir = path.resolve(options.models)
  fs.readdirSync(modelDir).forEach(model => {
    if (_.startsWith(model, '_')) return
    let modelName = _.upperFirst(_.camelCase(model.replace(path.extname(model), '')))
    bookshelf.model(modelName, require(path.join(modelDir, model))(baseModel, bookshelf))
  })

  server.on('stop', () => bookshelf.knex.destroy())

  // expose plugin
  server.expose(bookshelf)

  next()
}

exports.register.attributes = {
  name: 'database'
}
