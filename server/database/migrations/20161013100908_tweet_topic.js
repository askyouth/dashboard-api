'use strict'

exports.up = (knex, Promise) => knex.schema
  .createTable('tweet_topic', (table) => {
    table.increments().primary()
    table.bigInteger('tweet_id').notNullable().references('tweet.id')
      .onUpdate('cascade').onDelete('cascade')
    table.integer('topic_id').notNullable().references('topic.id')
      .onUpdate('cascade').onDelete('cascade')
    table.unique(['tweet_id', 'topic_id'])
    table.timestamps()
  })

exports.down = (knex, Promise) => knex.schema
  .dropTable('tweet_topic')
