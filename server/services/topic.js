'use strict'

// Module dependencies.
const _ = require('lodash')

const internals = {}

internals.dependencies = ['database']

exports.register = function (server, options, next) {
  const Database = server.plugins.database
  const Topic = Database.model('Topic')

  function prepareQuery (query) {
    query || (query = {})
    return Topic.query((qb) => {
      if (query.handle) {
        qb.innerJoin('handle_topic', 'topic.id', 'handle_topic.topic_id')
        qb.groupBy('topic.id')
        qb.where('handle_topic.handle_id', query.handle)
      }
      if (query.search) {
        qb.where(function () {
          this.where('topic.name', 'ilike', `%${query.search}%`)
            .orWhere('topic.description', 'ilike', `%${query.search}%`)
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

  function process (tweet) {
    return Topic
      .collection()
      .query('where', 'keywords', '!=', '{}')
      .fetch()
      .then((topics) => {
        let tokens = _.uniq(tweet.get('text').match(/\w+/g)).map(_.toLower)
        let matched = topics.filter((topic) => _.intersection(
          tokens,
          topic.get('keywords').map(_.toLower)
        ).length)

        if (!matched.length) return []
        return tweet.topics().attach(matched)
      })
  }

  server.expose('fetch', fetch)
  server.expose('process', process)

  next()
}

exports.register.attributes = {
  name: 'services/topic',
  dependencies: internals.dependencies
}
