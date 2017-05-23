'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'klout_score',

  schema: {
    id: Joi.number().integer(),
    value: Joi.number().required(),
    delta_day: Joi.number(),
    delta_week: Joi.number(),
    delta_month: Joi.number(),
    handle_id: Joi.string().required()
  },

  handle () {
    return this.belongsTo('Handle')
  }
})
