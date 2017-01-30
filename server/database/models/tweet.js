'use strict'

// Module dependencies.
const Joi = require('joi')

module.exports = (BaseModel, bookshelf) => BaseModel.extend({
  tableName: 'tweet',

  hasTimestamps: false,

  schema: {
    id: Joi.string().required(),
    text: Joi.string(),
    lang: Joi.string(),
    user_id: Joi.string(),
    user: Joi.object({
      id: Joi.string().required(),
      name: Joi.string(),
      screen_name: Joi.string(),
      location: Joi.string().allow(null),
      url: Joi.string().allow(null),
      description: Joi.string().allow(null),
      profile_image_url: Joi.string(),
      verified: Joi.boolean(),
      created_at: Joi.any()
    }),
    favorited: Joi.boolean(),
    retweeted: Joi.boolean(),
    entities: Joi.object(),
    extended_entities: Joi.object(),
    parent_id: Joi.string().allow(null),
    in_reply_to_user_id: Joi.string().allow(null),
    in_reply_to_screen_name: Joi.string().allow(null),
    contribution_id: Joi.number().integer().allow(null),
    created_at: Joi.date().timestamp()
  },

  handle () {
    return this.belongsTo('Handle', 'user_id')
  },

  parent () {
    return this.belongsTo('Tweet', 'parent_id')
  },

  replies () {
    return this.hasMany('Tweet', 'parent_id')
      .orderBy('created_at', 'asc')
  },

  topics () {
    return this.belongsToMany('Topic', 'tweet_topic')
  },

  contribution () {
    return this.belongsTo('Contribution', 'contribution_id')
  }
})
