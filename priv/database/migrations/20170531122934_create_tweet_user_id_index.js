'use strict'

exports.up = (knex, Promise) => knex.schema
  .table('tweet', (table) => {
    table.index('user_id')
  })

exports.down = (knex, Promise) => knex.schema
  .table('tweet', (table) => {
    table.dropIndex('user_id')
  })
