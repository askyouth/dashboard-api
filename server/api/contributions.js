'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')

const NotFoundError = Boom.notFound

const internals = {}

internals.dependencies = ['database', 'services/contribution']

internals.applyRoutes = (server, next) => {
  const Database = server.plugins.database
  const Camp = Database.model('Camp')
  const Contribution = Database.model('Contribution')

  function loadContribution (request, reply) {
    let contributionId = request.params.contributionId
    let contribution = Contribution.forge({ id: contributionId })
      .fetch({ require: true })
      .catch(Contribution.NotFoundError, () => {
        throw new NotFoundError('Contribution not found')
      })

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

      let cond = {
        eq: '=',
        min: '>=',
        max: '<='
      }

      let contributions = Contribution
        .query((qb) => {
          if (filter.campId) {
            qb.where('camp_id', filter.campId)
          }
          if (filter.topicId) {
            qb.where('topic_id', filter.topicId)
          }
          if (filter.conversationsOnly) {
            qb.where(function () {
              this.where('involves_pm', true)
                .andWhere('involves_youth', true)
            })
          }
          if (filter.tweets) {
            qb.where('tweets', cond[filter.tweetsCondition], filter.tweets)
          }
          if (filter.contributors) {
            let predicate = Database.knex.raw('array_length(contributors, 1)')
            qb.where(predicate, cond[filter.contributorsCondition], filter.contributors)
          }
          if (filter.search) {
            qb.innerJoin('tweet', 'tweet.contribution_id', 'contribution.id')
            qb.groupBy('contribution.id')
            qb.where(function () {
              this.where('tweet.text', 'ilike', `%${filter.search}%`)
                .orWhereRaw('tweet.user->>\'name\' ilike ?', `%${filter.search}%`)
                .orWhereRaw('tweet.user->>\'screen_name\' ilike ?', `%${filter.search}%`)
            })
          }
        })
        .orderBy(sort, sortOrder)
        .fetchPage({
          page: page,
          pageSize: pageSize
        })

      reply(contributions)
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
          topicId: Joi.number().integer()
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

  // TEST!!
  server.route({
    method: 'GET',
    path: '/contributions/{tweetId}/test',
    handler (request, reply) {
      let tweetId = request.params.tweetId
      let ContributionService = server.plugins['services/contribution']
      let result = Database.model('Tweet').forge({ id: tweetId })
        .fetch({ require: true })
        .then((tweet) => ContributionService.process(tweet))

      reply(result)
    }
  })

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.applyRoutes)
  next()
}

exports.register.attributes = {
  name: 'api/contributions',
  dependencies: internals.dependencies
}