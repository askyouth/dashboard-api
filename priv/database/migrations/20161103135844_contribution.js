'use strict'

exports.up = (knex, Promise) => knex.schema
  .createTable('contribution', (table) => {
    table.increments().primary()
    table.bigInteger('tweet_id').notNullable().references('tweet.id')
      .onUpdate('cascade').onDelete('cascade')
    table.integer('topic_id').references('topic.id')
      .onUpdate('cascade').onDelete('set null')
    table.integer('camp_id').references('camp.id')
      .onUpdate('cascade').onDelete('set null')
    table.boolean('involves_pm')
    table.boolean('involves_youth')
    table.integer('tweets').notNullable().defaultTo(1)
    table.specificType('contributors', 'varchar(255)[]').defaultTo('{}')
    table.timestamps()
  })
  .table('tweet', (table) => {
    table.integer('contribution_id').references('contribution.id')
      .onUpdate('cascade').onDelete('set null')
  })

exports.down = (knex, Promise) => knex.schema
  .table('tweet', (table) => {
    table.dropColumn('contribution_id')
  })
  .dropTable('contribution')
