'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'infographic',

  schema: {
    id: Joi.number().integer(),
    name: Joi.string().required(),
    url: Joi.string().uri().required()
  }
})
