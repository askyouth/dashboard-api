'use strict'

// Module dependencies.
const _ = require('lodash')

const internals = {}

internals.dependencies = [
  'database',
  'services/klout',
  'services/twitter'
]

internals.init = (server, next) => {
  const log = server.log.bind(server, ['services', 'handle'])
  const Klout = server.plugins['services/klout']
  const Twitter = server.plugins['services/twitter']
  const Database = server.plugins.database
  const Handle = Database.model('Handle')
  const Camp = Database.model('Camp')

  fetchBrokerHandle()

  function fetchBrokerHandle () {
    return Handle.forge({ camp_id: Camp.BROKER })
      .fetch({ require: true })
      .catch(Handle.NotFoundError, () => {
        return Twitter.verifyCredentials()
          .tap(header => console.log(header))
          .then((profile) => [profile, Klout.getIdentity(profile.screen_name).catch((err) => {
            if (err.message.match(/not found/i)) return {}
            throw err
          })])
          .spread((profile, klout) => {
            return Handle.forge({
              id: profile.id_str,
              username: profile.screen_name,
              name: profile.name,
              profile: {
                image: profile.profile_image_url_https,
                description: profile.description
              },
              camp_id: Camp.BROKER,
              klout_id: klout.id
            }).save(null, { method: 'insert' })
          }).tap((handle) => {
            Twitter.follow(handle.get('id'))
          })
      })
      .catch((err) => log(`error: ${err.message}`))
  }

  function prepareQuery (query) {
    query || (query = {})
    return Handle.query((qb) => {
      if (query.camp) {
        qb.where('handle.camp_id', '=', query.camp)
      } else {
        qb.where('handle.camp_id', '!=', Camp.BROKER)
      }
      if (query.topic) {
        qb.innerJoin('handle_topic', 'handle.id', 'handle_topic.handle_id')
        qb.groupBy('handle.id')
        qb.where('handle_topic.topic_id', query.topic)
      }
      if (query.search) {
        qb.where(function () {
          this.where('handle.username', 'ilike', `%${query.search}%`)
            .orWhere('handle.name', 'ilike', `%${query.search}%`)
        })
      }
    })
  }

  function fetch (query, opts) {
    opts || (opts = {})
    let sortBy = opts.sortBy || 'name'
    let sortOrder = opts.sortOrder || 'asc'
    let page = opts.page || 1
    let pageSize = opts.pageSize || 20
    let fetchOpts = Object.assign({
      page: page,
      pageSize: pageSize
    }, _.pick(opts, ['withRelated']))

    return prepareQuery(query)
      .orderBy(sortBy, sortOrder)
      .fetchPage(fetchOpts)
  }

  function count (query) {
    return prepareQuery(query)
      .count()
      .then((count) => +count)
  }

  server.expose('fetch', fetch)
  server.expose('count', count)

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.init)
  next()
}

exports.register.attributes = {
  name: 'services/handle',
  dependencies: internals.dependencies
}
