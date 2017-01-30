'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'contribution',

  schema: {
    id: Joi.number().integer(),
    tweet_id: Joi.string().required(),
    topic_id: Joi.number().integer().allow(null),
    camp_id: Joi.number().integer().allow(null),
    tweets: Joi.number().integer().required(),
    involves_pm: Joi.boolean().allow(null),
    involves_youth: Joi.boolean().allow(null),
    contributors: Joi.array().items(Joi.string())
  },

  default: {
    contributors: []
  },

  tweet () {
    return this.belongsTo('Tweet', 'tweet_id')
  },

  topic () {
    return this.belongsTo('Topic', 'topic_id')
  },

  camp () {
    return this.belongsTo('Camp', 'camp_id')
  }
})
