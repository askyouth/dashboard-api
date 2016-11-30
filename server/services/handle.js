'use strict'

// Module dependencies.
const _ = require('lodash')

const internals = {}

internals.dependencies = [
  'database'
]

exports.register = function (server, options, next) {
  const Database = server.plugins.database
  const Handle = Database.model('Handle')

  function fetch (query, opts) {
    query || (query = {})
    opts || (opts = {})
    let sortBy = opts.sortBy || 'name'
    let sortOrder = opts.sortOrder || 'asc'
    let page = opts.page || 1
    let pageSize = opts.pageSize || 20
    let fetchOpts = Object.assign({
      page: page,
      pageSize: pageSize
    }, _.pick(opts, ['withRelated']))

    return Handle
      .query((qb) => {
        if (query.camp) {
          qb.where('handle.camp_id', '=', query.camp)
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
      .orderBy(sortBy, sortOrder)
      .fetchPage(fetchOpts)
  }

  server.expose('fetch', fetch)

  next()
}

exports.register.attributes = {
  name: 'services/handle',
  dependencies: internals.dependencies
}
