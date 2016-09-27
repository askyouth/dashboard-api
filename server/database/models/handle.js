'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'handle',

  schema: {
    id: Joi.number().integer(),
    uid: Joi.string().required(),
    username: Joi.string().required(),
    name: Joi.string().required(),
    profile: Joi.object({
      image: Joi.string().uri(),
      description: Joi.string()
    }).default({}),
    camp_id: Joi.number().integer().allow(null)
  },

  topics () {
    return this.belongsToMany('Topic', 'handle_topic')
  }
})
