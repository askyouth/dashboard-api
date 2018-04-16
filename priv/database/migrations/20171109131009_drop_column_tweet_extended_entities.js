'use strict'

exports.up = (knex, Promise) => knex.schema
  .table('tweet', (t) => {
    t.dropColumn('extended_entities')
  })

exports.down = (knex, Promise) => knex.schema
  .table('tweet', (t) => {
    t.jsonb('extended_entities').default('{}')
  })
