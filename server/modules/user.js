'use strict'

// Module dependencies.
const Deputy = require('hapi-deputy')
const _ = require('lodash')

exports.register = function (server, options, next) {
  const Database = server.plugins['services/database']

  const User = Database.model('User')

  function prepareQuery (query) {
    query || (query = {})

    return User.query((qb) => {
      if (query.search) {
        qb.where(function () {
          this.where('user.name', 'ilike', `%${query.search}%`)
            .orWhere('user.email', 'ilike', `%${query.search}%`)
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

exports.register.attributes = {
  name: 'modules/user',
  dependencies: [
    'services/database'
  ]
}

module.exports = Deputy(exports)
