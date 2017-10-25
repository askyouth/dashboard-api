'use strict'

exports.up = (knex, Promise) => knex.schema
  .createTable('session', (table) => {
    table.increments().primary()
    table.integer('user_id').notNullable().references('user.id')
      .onUpdate('cascade').onDelete('cascade')
    table.timestamp('valid_from')
    table.timestamp('valid_to')
  })

exports.down = (knex, Promise) => knex.schema
  .dropTable('session')
