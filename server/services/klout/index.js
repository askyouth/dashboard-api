'use strict'

// Module dependencies.
const Joi = require('joi')
const Klout = require('node_klout')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')
const perioda = require('perioda')

Promise.promisifyAll(Klout.prototype)

exports.validate = {
  schema: {
    auth: Joi.string().required(),
    interval: Joi.number().integer().required()
  },
  message: 'Invalid Klout configuration.'
}

exports.register = function (server, options, next) {
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

  class KloutError extends Error {}

  function getUserScore (kloutId) {
    return klout.getUserScoreAsync(kloutId)
      .then((result) => {
        if (result.validationErrors) {
          throw new KloutError('Invalid Klout ID')
        }
        return result
      })
  }

  function deleteKlout (handle) {
    return handle.save({
      klout_id: null,
      klout_score: null
    })
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
      .then((handle) => [
        handle,
        getUserScore(handle.get('klout_id'))
          .catch(KloutError, (err) => {
            return deleteKlout(handle).then(() => {
              throw err
            })
          })
      ])
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

exports.register.attributes = {
  name: 'services/klout',
  dependencies: [
    'services/database'
  ]
}

module.exports = Deputy(exports)
