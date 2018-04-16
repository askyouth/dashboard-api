'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'camp',

  schema: {
    id: Joi.number().integer(),
    name: Joi.string().required(),
    description: Joi.string()
  },

  handles () {
    return this.hasMany('Handle')
  }
}, {
  POLICY_MAKER: 1,
  YOUTH: 2,
  BROKER: 3
})
