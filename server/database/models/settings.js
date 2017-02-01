'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'settings',

  schema: {
    id: Joi.number().integer(),
    name: Joi.string().required(),
    description: Joi.string().allow(null),
    type: Joi.string(),
    value: Joi.string().allow('')
  }
})
