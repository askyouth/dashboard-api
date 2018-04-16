'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'user',

  schema: {
    id: Joi.number().integer(),
    email: Joi.string().email().required(),
    name: Joi.string().allow(null),
    password: Joi.string().required(),
    password_reset: Joi.string().allow(null),
    last_login_at: Joi.date().timestamp().allow(null)
  },

  hidden: ['password', 'password_reset']
})
