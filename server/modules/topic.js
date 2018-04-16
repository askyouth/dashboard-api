'use strict'

// Module dependencies.
const Deputy = require('hapi-deputy')
const _ = require('lodash')

exports.register = function (server, options, next) {
  const Database = server.plugins['services/database']

  const Topic = Database.model('Topic')

  // taken from https://github.com/phugh/happynodetokenize
  const tokenRegex = new RegExp(/(?:(?:\+?[01][\-\s.]*)?(?:[\(]?\d{3}[\-\s.\)]*)?\d{3}[\-\s.]*\d{4})|(?:[<>]?[:;=8>][\-o\*\']?[\)\]\(\[dDpPxX\/\:\}\{@\|\\]|[\)\]\(\[dDpPxX\/\:\}\{@\|\\][\-o\*\']?[:;=8<][<>]?|<3|\(?\(?\#?\(?\(?\#?[>\-\^\*\+o\~][\_\.\|oO\,][<\-\^\*\+o\~][\#\;]?\)?\)?)|(?:(?:http[s]?\:\/\/)?(?:[\w\_\-]+\.)+(?:com|net|gov|edu|info|org|ly|be|gl|co|gs|pr|me|cc|us|gd|nl|ws|am|im|fm|kr|to|jp|sg))|(?:http[s]?\:\/\/)|(?:\[[a-z_]+\])|(?:\/\w+\?(?:\;?\w+\=\w+)+)|<[^>]+>|(?:@[\w_]+)|(?:\#+[\w_]+[\w\'_\-]*[\w_]+)|(?:[a-z][a-z'\-_]+[a-z])|(?:[+\-]?\d+[,\/.:-]\d+[+\-]?)|(?:[\w_]+)|(?:\.(?:\s*\.){1,})|(?:\S)/, 'gi')
  const log = server.log.bind(server, ['modules', 'topic'])

  const Topics = {
    store: {},
    async init () {
      let topics = await Database.knex('topic')
        .whereNot('keywords', '{}')
        .select(['id', 'keywords'])

      topics.forEach(({ id, keywords }) => this.add(id, keywords.map(_.toLower)))
    },
    add (id, keywords) {
      this.store[id] = new Set(keywords)
    },
    delete (id, keyword) {
      delete this.store[id]
    },
    match (tokens) {
      return Object.keys(this.store)
        .filter((id) => tokens.find((token) => this.store[id].has(token)))
        .map((id) => +id)
    }
  }

  Topics.init().catch((err) => log(`error init topics: ${err.message}`))

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

  async function process (tweet) {
    let tokens = tweet.get('text').toLowerCase().match(tokenRegex)
    let topics = Topics.match(tokens)

    if (topics.length) {
      await tweet.topics().attach(topics)
    }

    return topics
  }

  function created ({ id, keywords }) {
    Topics.add(id, keywords)
  }

  function removed ({ id }) {
    Topics.delete(id)
  }

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

  server.expose('fetch', fetch)
  server.expose('count', count)
  server.expose('process', process)
  server.expose('created', created)
  server.expose('removed', removed)

  next()
}

exports.register.attributes = {
  name: 'modules/topic',
  dependencies: [
    'services/database'
  ]
}

module.exports = Deputy(exports)
