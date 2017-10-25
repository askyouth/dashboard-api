'use strict'

// Module dependencies.
const cache = require('arr-cache')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')

exports.register = function (server, options, next) {
  const Twitter = server.plugins['services/twitter']
  const Settings = server.plugins['modules/settings']

  const c = cache({ keeptime: '60s' })

  server.route({
    method: 'GET',
    path: '/config',
    config: {
      description: 'Get public settings',
      auth: false
    },
    handler (request, reply) {
      let config = Settings.get(['signup.enabled'])
      reply(config)
    }
  })

  server.route({
    method: 'GET',
    path: '/settings',
    config: {
      description: 'Fetch settings'
    },
    handler (request, reply) {
      let settings = Promise.props({
        settings: Settings.get(),
        lists: Promise.resolve(c.fetch('lists'))
          .then((lists) => {
            if (lists) return lists
            return Twitter.listOwnerships().then((lists) => {
              lists = lists.map((list) => ({
                id: list.id_str,
                name: list.name,
                full_name: list.full_name,
                description: list.description,
                slug: list.slug,
                mode: list.mode,
                uri: list.uri,
                member_count: list.member_count,
                subscriber_count: list.subscriber_count,
                created_at: list.created_at
              }))
              c.add('lists', lists)
              return lists
            })
          })
      })

      reply(settings)
    }
  })

  server.route({
    method: 'POST',
    path: '/settings',
    config: {
      description: 'Update settings'
    },
    handler (request, reply) {
      let settings = request.payload
      if (!settings || Object.keys(settings).length === 0) {
        return reply({})
      }
      let promise = Settings.set(settings)

      reply(promise)
    }
  })

  next()
}

exports.register.attributes = {
  name: 'api/settings',
  dependencies: [
    'services/twitter',
    'modules/settings'
  ]
}

module.exports = Deputy(exports)
