'use strict'

exports.up = (knex, Promise) => knex.schema
  .createTable('tweet', (table) => {
    table.bigInteger('id').primary()
    table.text('text')
    table.string('lang')
    table.bigInteger('user_id')
    table.jsonb('user')
    table.boolean('favorited')
    table.boolean('retweeted')
    table.jsonb('entities').default('{}')
    table.jsonb('extended_entities').default('{}')
    table.bigInteger('parent_id').index()
    table.bigInteger('in_reply_to_user_id')
    table.string('in_reply_to_screen_name')
    table.timestamp('created_at')
  })

exports.down = (knex, Promise) => knex.schema
  .dropTable('tweet')
