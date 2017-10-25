'use strict'

exports.up = (knex, Promise) => knex.schema
  .createTable('settings', (table) => {
    table.increments().primary()
    table.string('name').notNullable().unique()
    table.string('description')
    table.string('type').defaultsTo('string')
    table.string('value')
    table.timestamps()
  })

exports.down = (knex, Promise) => knex.schema
  .dropTable('settings')
