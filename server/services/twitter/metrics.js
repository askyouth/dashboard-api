'use strict'

// Module dependencies.
const Deputy = require('hapi-deputy')

exports.register = function (server, options, next) {
  const Twitter = server.plugins['services/twitter']
  const Database = server.plugins['services/database']

  const knex = Database.knex
  const log = server.log.bind(server, ['services', 'twitter', 'metrics'])

  runner(run, 1000)

  async function run ({ lastId } = {}) {
    log(`fetching from ${lastId || 'beginning'}`)

    let ids = await getTweetIds(lastId)
    if (!ids.length) return {}

    let { id: tweets } = await Twitter.statusesLookup(ids, {
      map: true,
      trim_user: true,
      include_entities: false
    })

    for (let id of ids) {
      let tweet = tweets[id] || {}
      if (!tweet.id) continue
      try {
        await knex('tweet').where('id', id).update({
          retweets: tweet.retweet_count,
          favorites: tweet.favorite_count,
          updated_at: new Date()
        })
      } catch (err) {
        log(`error processing tweet: ${err.message}`)
      }
    }

    return {
      lastId: ids[ids.length - 1]
    }
  }

  async function getTweetIds (lastId, limit = 100) {
    let qb = knex('tweet')
      .select('id')
      .whereNotNull('contribution_id')
      .orderBy('id', 'desc')
      .limit(limit)

    if (lastId) {
      qb.where('id', '<', lastId)
    }

    return (await qb).map((row) => row.id)
  }

  async function runner (fn, time, state = {}) {
    try {
      state = await fn(state)
    } catch (err) {
      log(`error: ${err.message}`)
    }
    await sleep(time)
    return runner(fn, time, state)
  }

  function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time))
  }

  next()
}

exports.register.attributes = {
  name: 'services/twitter/stats',
  dependencies: [
    'services/twitter',
    'services/database'
  ]
}

module.exports = Deputy(exports)
