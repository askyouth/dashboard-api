'use strict'

const now = new Date()
const camp = (id, name) => ({ id: id, name: name, created_at: now, updated_at: now })
const topic = (name) => ({ name: name, created_at: now, updated_at: now })
const setting = (name, type, value) => ({ name: name, type: type, value: value })

exports.seed = (knex, Promise) => Promise.all([
  knex('camp').del(),
  knex('topic').del(),
  knex('settings').del()
]).then(() => Promise.all([
  knex('camp').insert([
    camp(1, 'Policy maker'),
    camp(2, 'Youth'),
    camp(3, 'Broker')
  ]),
  knex('topic').insert([
    topic('Sexual orientation & gender rights'),
    topic('Economic crisis / Economy'),
    topic('NEETs'),
    topic('Immigration'),
    topic('Environment'),
    topic('Terrorism'),
    topic('Education & Employment'),
    topic('EU (dis)integration'),
    topic('Democracy & human rights'),
    topic('Health')
  ]),
  knex('settings').insert([
    setting('signup.enabled', 'boolean', 'true')
  ])
]))
