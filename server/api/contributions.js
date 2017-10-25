'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')

exports.register = function (server, options, next) {
  const Database = server.plugins['services/database']
  const Contributions = server.plugins['modules/contribution']

  const Camp = Database.model('Camp')
  const Contribution = Database.model('Contribution')

  function loadContribution (request, reply) {
    let contributionId = request.params.contributionId
    let contribution = Contribution.forge({ id: contributionId })
      .fetch({ require: true })
      .catch(Contribution.NotFoundError, () => Boom.notFound('Contribution not found'))

    reply(contribution)
  }

  server.route({
    method: 'GET',
    path: '/contributions',
    config: {
      description: 'Get list of contributions',
      validate: {
        query: {
          filter: Joi.object({
            search: Joi.string(),
            topicId: Joi.number().integer(),
            campId: Joi.number().integer().valid([Camp.POLICY_MAKER, Camp.YOUTH, Camp.BROKER]),
            conversationsOnly: Joi.boolean().default(false),
            contributors: Joi.number().integer(),
            contributorsCondition: Joi.string().valid(['min', 'max', 'eq']).default('eq'),
            tweets: Joi.number().integer(),
            tweetsCondition: Joi.string().valid(['min', 'max', 'eq']).default('eq')
          }).default({}),
          page: Joi.number().integer().default(1),
          pageSize: Joi.number().integer().default(20),
          sort: Joi.string().valid(['created_at']).default('created_at'),
          sortOrder: Joi.string().valid(['asc', 'desc']).default('asc')
        }
      }
    },
    handler (request, reply) {
      let filter = request.query.filter
      let page = request.query.page
      let pageSize = request.query.pageSize
      let sort = request.query.sort
      let sortOrder = request.query.sortOrder
      let related = ['tweet']

      let result = Promise.props({
        contributions: Contributions.fetch(filter, {
          sortBy: sort,
          sortOrder: sortOrder,
          page: page,
          pageSize: pageSize,
          withRelated: related
        }),
        count: Contributions.count(filter)
      })

      reply(result)
    }
  })

  server.route({
    method: 'GET',
    path: '/contributions/{contributionId}',
    config: {
      description: 'Get contribution',
      validate: {
        params: {
          contributionId: Joi.number().integer().required()
        }
      },
      pre: [{
        method: loadContribution, assign: 'contribution'
      }]
    },
    handler (request, reply) {
      let contribution = request.pre.contribution
      let tweets = contribution.related('tweet')
        .fetch({ withRelated: ['replies'] })
        .then((tweet) => [tweet].concat(tweet.related('replies').toArray()))

      reply(tweets)
    }
  })

  server.route({
    method: 'PUT',
    path: '/contributions/{contributionId}',
    config: {
      description: 'Update contribution',
      validate: {
        payload: {
          topic_id: Joi.number().integer().allow(null)
        }
      },
      pre: [{
        assign: 'contribution',
        method: loadContribution
      }]
    },
    handler (request, reply) {
      let payload = request.payload
      let contribution = request.pre.contribution

      contribution = contribution.save(payload)

      reply(contribution)
    }
  })

  next()
}

exports.register.attributes = {
  name: 'api/contributions',
  dependencies: [
    'services/database',
    'modules/contribution'
  ]
}

module.exports = Deputy(exports)
