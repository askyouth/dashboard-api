'use strict'

// Module dependencies.
const _ = require('lodash')

const internals = {}

internals.dependencies = ['database']

exports.register = function (server, options, next) {
  const Database = server.plugins.database
  const Topic = Database.model('Topic')

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

  server.expose('process', process)

  next()
}

exports.register.attributes = {
  name: 'services/topic',
  dependencies: internals.dependencies
}
