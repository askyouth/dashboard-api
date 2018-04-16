'use strict'

exports.up = (knex, Promise) => knex.schema
  .raw('ALTER TABLE handle_topic ALTER COLUMN handle_id TYPE bigint;')
    .then(() => knex.schema.raw('ALTER TABLE klout_score ALTER COLUMN handle_id TYPE bigint;'))
    .then(() => knex.schema.raw('ALTER TABLE handle ALTER COLUMN id TYPE bigint;'))
    .then(() => knex.schema.raw('ALTER TABLE handle ALTER COLUMN id DROP DEFAULT;'))
    .then(() => knex('handle').select())
    .then((handles) => Promise.map(handles, (handle) => {
      return knex('handle').where('id', handle.id).update({ id: handle.uid })
    }))
    .then(() => knex.schema.raw('ALTER TABLE handle DROP COLUMN uid;'))
    .then(() => knex.schema.raw('ALTER SEQUENCE handle_id_seq OWNED BY NONE;'))
    .then(() => knex.schema.raw('DROP SEQUENCE handle_id_seq;'))

exports.down = (knex, Promise) => knex.schema
  .raw('ALTER TABLE handle ADD COLUMN uid bigint')
    .then(() => knex('handle').select())
    .then((handles) => Promise.map(handles, (handle, i) => {
      return knex('handle').where('id', handle.id).update({ id: i + 1, uid: handle.id })
    }))
    .then((handles) => {
      return knex.schema.raw(`CREATE SEQUENCE handle_id_seq START ${handles.length + 1};`)
    })
    .then(() => knex.schema.raw('ALTER SEQUENCE handle_id_seq OWNED BY handle.id;'))
    .then(() => knex.schema.raw('ALTER TABLE handle ALTER COLUMN id TYPE integer;'))
    .then(() => knex.schema.raw('ALTER TABLE handle ALTER COLUMN id SET DEFAULT nextval(\'handle_id_seq\');'))
    .then(() => knex.schema.raw('ALTER TABLE handle ALTER COLUMN uid SET NOT NULL;'))
    .then(() => knex.schema.raw('ALTER TABLE handle ADD CONSTRAINT handle_uid_unique UNIQUE (uid);'))
    .then(() => knex.schema.raw('ALTER TABLE handle_topic ALTER COLUMN handle_id TYPE integer;'))
    .then(() => knex.schema.raw('ALTER TABLE klout_score ALTER COLUMN handle_id TYPE integer;'))
