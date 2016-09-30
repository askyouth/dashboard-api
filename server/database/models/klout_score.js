'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'klout_score',

  schema: {
    id: Joi.number().integer(),
    value: Joi.number().required(),
    handle_id: Joi.number().integer().required()
  },

  handle () {
    return this.belongsTo('Handle')
  }
})
