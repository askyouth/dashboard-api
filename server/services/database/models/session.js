'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'session',

  hasTimestamps: false,

  schema: {
    id: Joi.number().integer(),
    user_id: Joi.number().integer().required(),
    valid_from: Joi.date().timestamp(),
    valid_to: Joi.date().timestamp().allow(null)
  },

  user () {
    return this.belongsTo('User', 'user_id')
  }
})
