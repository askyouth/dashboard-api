'use strict'

// Module dependencies.
const Joi = require('joi')
const Klout = require('node_klout')
const Promise = require('bluebird')
const perioda = require('perioda')

Promise.promisifyAll(Klout.prototype)

const internals = {}

internals.dependencies = [
  'services/database'
]

internals.init = function (server, options, next) {
  const Database = server.plugins['services/database']

  const Handle = Database.model('Handle')
  const KloutScore = Database.model('KloutScore')
  const log = server.log.bind(server, ['services', 'klout'])

  const klout = new Klout(options.auth)
  const task = perioda(check, options.interval)
  task.on('error', (err) => log(`error: ${err.message}`))
  options.interval && task.start()

  function getIdentity (username) {
    return klout.getKloutIdentityAsync(username).catch((err) => {
      if (err.message.match(/not found/i)) return {}
      throw err
    })
  }

  function getUserScore (kloutId) {
    return klout.getUserScoreAsync(kloutId)
  }

  function check () {
    log('fetching...')

    return Handle
      .query((qb) => {
        qb.select(['handle.*', Database.knex.raw('max(klout_score.created_at) as last_check')])
          .leftJoin('klout_score', 'handle.id', 'klout_score.handle_id')
          .whereNotNull('handle.klout_id')
          .groupBy('handle.id')
          .orderByRaw('last_check asc nulls first')
      })
      .fetch({ require: true })
      .then((handle) => [handle, getUserScore(handle.get('klout_id'))])
      .spread((handle, klout) => Promise.join(
        handle.save({ klout_score: klout.score }),
        KloutScore.forge({
          handle_id: handle.get('id'),
          value: klout.score,
          delta_day: klout.scoreDelta.dayChange,
          delta_week: klout.scoreDelta.weekChange,
          delta_month: klout.scoreDelta.monthChange
        }).save()
      ))
      .catch(Handle.NotFoundError, () => {
        log('no handles')
      })
  }

  server.expose('getIdentity', getIdentity)

  next()
}

exports.register = function (server, options, next) {
  const schema = Joi.object({
    auth: Joi.string().required(),
    interval: Joi.number().integer().required()
  })

  try {
    options = Joi.attempt(options, schema, 'Invalid Klout configuration')
  } catch (err) {
    return next(err)
  }

  server.dependency(internals.dependencies, (server, next) => {
    internals.init(server, options, next)
  })

  next()
}

exports.register.attributes = {
  name: 'services/klout',
  dependencies: internals.dependencies
}
