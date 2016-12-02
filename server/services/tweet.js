'use strict'

// Module dependencies.
const _ = require('lodash')

const internals = {}

internals.dependencies = ['database']

internals.init = (server, next) => {
  const Database = server.plugins.database
  const Tweet = Database.model('Tweet')

  function fetch (query, opts) {
    query || (query = {})
    opts || (opts = {})
    let queryFn = query.queryFn || _.noop
    let limit = opts.limit || 20
    let sortBy = opts.sortBy || 'created_at'
    let sortOrder = opts.sortOrder || 'asc'
    let fetchOpts = _.pick(opts, ['withRelated'])

    let tweets = Tweet.collection()
      .query((qb) => {
        if (query.maxId) qb.andWhere('tweet.id', '<', query.maxId)
        if (query.userId) qb.andWhere('tweet.user_id', '=', query.userId)
        if (query.topicId) {
          qb.innerJoin('tweet_topic', 'tweet.id', 'tweet_topic.tweet_id')
          qb.groupBy('tweet.id')
          qb.where('tweet_topic.topic_id', query.topicId)
        }
        if (query.search) {
          qb.where('text', 'ilike', `%${query.search}%`)
        }
        queryFn(qb)
        qb.limit(limit)
      })
      .orderBy(sortBy, sortOrder)
      .fetch(fetchOpts)

    return tweets
  }

  server.expose('fetch', fetch)

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.init)
  next()
}

exports.register.attributes = {
  name: 'services/tweet',
  dependencies: internals.dependencies
}
