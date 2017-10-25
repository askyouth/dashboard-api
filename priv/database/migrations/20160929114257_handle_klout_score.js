'use strict'

exports.up = (knex, Promise) => knex.schema
  .createTable('klout_score', (table) => {
    table.increments().primary()
    table.integer('handle_id').notNullable().references('handle.id')
      .onUpdate('cascade').onDelete('cascade')
    table.float('value').notNullable()
    table.float('delta_day')
    table.float('delta_week')
    table.float('delta_month')
    table.timestamps()
  })
  .table('handle', (table) => {
    table.bigInteger('klout_id').unique()
    table.float('klout_score')
  })

exports.down = (knex, Promise) => knex.schema
  .dropTable('klout_score')
  .table('handle', (table) => {
    table.dropColumn('klout_id')
    table.dropColumn('klout_score')
  })
