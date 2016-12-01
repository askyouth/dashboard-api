'use strict'

exports.up = (knex, Promise) => knex.schema
  .table('infographic', (table) => {
    table.bigInteger('file_size').notNullable()
    table.string('file_type')
  })

exports.down = (knex, Promise) => knex.schema
  .table('infographic', (table) => {
    table.dropColumn('file_size')
    table.dropColumn('file_type')
  })
