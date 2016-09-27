'use strict'

const now = new Date()
const camp = (id, name) => ({ id: id, name: name, created_at: now, updated_at: now })
const topic = (name) => ({ name: name, created_at: now, updated_at: now })

exports.seed = (knex, Promise) => Promise.all([
  knex('camp').del(),
  knex('topic').del()
]).then(() => Promise.all([
  knex('camp').insert([
    camp(1, 'Policy maker'),
    camp(2, 'Youth')
  ]),
  knex('topic').insert([
    topic('Sexual orientation & gender rights'),
    topic('Economic crisis / Economy'),
    topic('Terrorism'),
    topic('NEETs'),
    topic('Immigration'),
    topic('Environment')
  ])
]))
