'use strict'

exports.up = (knex, Promise) => knex.schema
  .createTable('infographic', (table) => {
    table.increments().primary()
    table.string('name').notNullable()
    table.string('url').notNullable()
    table.timestamps()
  })

exports.down = (knex, Promise) => knex.schema
  .dropTable('infographic')
