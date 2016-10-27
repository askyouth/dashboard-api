'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'handle',

  schema: {
    id: Joi.string().required(),
    username: Joi.string().required(),
    name: Joi.string().required(),
    profile: Joi.object({
      image: Joi.string().uri(),
      description: Joi.string().allow('')
    }),
    klout_id: Joi.number().integer().allow(null),
    klout_score: Joi.number().allow(null),
    camp_id: Joi.number().integer().allow(null)
  },

  defaults: {
    profile: {}
  },

  flatten: {
    camp: ['id', 'name']
  },

  camp () {
    return this.belongsTo('Camp')
  },

  topics () {
    return this.belongsToMany('Topic', 'handle_topic')
  },

  kloutScores () {
    return this.hasMany('KloutScore')
  }
})
