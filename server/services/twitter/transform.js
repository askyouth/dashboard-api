'use strict'

// Module dependencies.
const _ = require('lodash')

module.exports = (tweet) => ({
  id: tweet.id_str,
  text: tweet.text,
  lang: tweet.lang,
  user_id: tweet.user.id_str,
  user: {
    id: tweet.user.id_str,
    name: tweet.user.name,
    screen_name: tweet.user.screen_name,
    location: tweet.user.location,
    url: tweet.user.url,
    description: tweet.user.description,
    profile_image_url: `https://twitter.com/${tweet.user.screen_name}/profile_image?size=original`,
    profile_avatar_url: `https://twitter.com/${tweet.user.screen_name}/profile_image?size=normal`,
    verified: tweet.user.verified,
    created_at: new Date(tweet.user.created_at)
  },
  favorited: tweet.favorited,
  retweeted: tweet.retweeted,
  entities: Object.assign(tweet.entities, {
    user_mentions: _.map(tweet.entities.user_mentions, (user) => ({
      id: user.id_str,
      name: user.name,
      screen_name: user.screen_name
    }))
  }),
  extended_entities: tweet.extended_entities,
  parent_id: tweet.in_reply_to_status_id_str,
  in_reply_to_user_id: tweet.in_reply_to_user_id_str,
  in_reply_to_screen_name: tweet.in_reply_to_screen_name,
  created_at: new Date(tweet.created_at)
})
