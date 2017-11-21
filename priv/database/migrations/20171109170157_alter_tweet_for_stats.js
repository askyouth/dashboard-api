'use strict'

exports.up = (knex, Promise) => knex.schema
  .table('tweet', (t) => {
    t.integer('retweets')
    t.integer('favorites')
    t.timestamp('updated_at')
    t.index('contribution_id')
  })

exports.down = (knex, Promise) => knex.schema
  .table('tweet', (t) => {
    t.dropColumn('retweets')
    t.dropColumn('favorites')
    t.dropColumn('updated_at')
    t.dropIndex('contribution_id')
  })
