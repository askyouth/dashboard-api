'use strict'

exports.up = (knex, Promise) => knex.schema
  .table('topic', (table) => {
    table.dropColumn('keywords')
  })
  .table('topic', (table) => {
    table.specificType('keywords', 'varchar(255)[]')
  })

exports.down = (knex, Promise) => knex.schema
  .table('topic', (table) => {
    table.dropColumn('keywords')
  })
  .table('topic', (table) => {
    table.jsonb('keywords').defaultTo('[]')
  })
