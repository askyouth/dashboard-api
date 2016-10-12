'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'topic',

  schema: {
    id: Joi.number().integer(),
    name: Joi.string().required(),
    description: Joi.string().allow(null),
    keywords: Joi.array().items(Joi.string())
  },

  defaults: {
    keywords: []
  },

  handles () {
    return this.belongsToMany('Handle', 'handle_topic')
  }
})
