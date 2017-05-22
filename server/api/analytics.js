'use strict'

// Module dependencies.
const Joi = require('joi')

const internals = {}

internals.dependencies = ['database']

internals.applyRoutes = (server, next) => {
  const Database = server.plugins.database
  const Camp = Database.model('Camp')
  const knex = Database.knex

  server.route({
    method: 'GET',
    path: '/analytics/klout',
    config: {
      description: 'Get Klout score changes'
    },
    handler (request, reply) {
      let handles = knex
        .select('*')
        .from(function () {
          this
            .select([
              '*',
              knex.raw(`row_number() over (partition by (klout_delta < 0)
                                            order by abs(klout_delta) desc) as rownum`)
            ])
            .from(function () {
              this
                .select([
                  knex.raw('distinct on (ks.handle_id) h.id'),
                  'h.username',
                  'h.name',
                  'h.profile',
                  'h.camp_id',
                  'c.name as camp_name',
                  'h.klout_id',
                  'h.klout_score',
                  'ks.delta_week as klout_delta'
                ])
                .from('klout_score as ks')
                .join('handle as h', 'ks.handle_id', 'h.id')
                .join('camp as c', 'h.camp_id', 'c.id')
                .whereNot('c.id', Camp.BROKER)
                .whereBetween('ks.created_at', [
                  knex.raw(`(now() - '7 day'::interval)::timestamp`),
                  knex.raw('now()')
                ])
                .orderBy('ks.handle_id')
                .orderBy('ks.created_at', 'desc')
                .as('p1')
            })
            .as('p2')
        })
        .where('rownum', '<=', 5)

      reply(handles)
    }
  })

  server.route({
    method: 'GET',
    path: '/analytics/contributors',
    config: {
      description: 'Get top contributors'
    },
    handler (request, reply) {
      let contributors = knex('tweet')
        .select([
          'handle.id',
          'handle.username',
          'handle.name',
          'handle.profile',
          'handle.camp_id',
          'camp.name as camp_name',
          'handle.klout_id',
          'handle.klout_score',
          knex.raw('count(tweet.id) as contributions')
        ])
        .join('handle', 'tweet.user_id', 'handle.id')
        .join('camp', 'handle.camp_id', 'camp.id')
        .whereNotNull('tweet.contribution_id')
        .whereBetween('tweet.created_at', [
          knex.raw('(now() - \'7 day\'::interval)::timestamp'),
          knex.raw('now()')
        ])
        .groupBy('handle.id', 'camp.id')
        .orderBy('contributions', 'desc')
        .then((handles) => handles.map((handle) => ({
          id: handle.id,
          username: handle.username,
          name: handle.name,
          profile: handle.profile,
          camp_id: handle.camp_id,
          camp: {
            id: handle.camp_id,
            name: handle.camp_name
          },
          klout_id: handle.klout_id,
          klout_score: handle.klout_score,
          contributions: +handle.contributions,
          created_at: handle.created_at,
          updated_at: handle.updated_at
        })))

      reply(contributors)
    }
  })

  server.route({
    method: 'GET',
    path: '/analytics/tweeters',
    config: {
      description: 'Get most active users',
      validate: {
        query: {
          days: Joi.number().integer().max(30).default(7),
          limit: Joi.number().integer().max(200).default(20)
        }
      }
    },
    handler (request, reply) {
      let days = request.query.days
      let limit = request.query.limit

      let handles = knex
        .select([
          'handle.id',
          'handle.username',
          'handle.name',
          'handle.profile',
          'handle.camp_id',
          'camp.name as camp_name',
          'handle.klout_id',
          'handle.klout_score',
          'handle.created_at',
          'handle.updated_at',
          'tweet.tweets'
        ])
        .from(function () {
          this
            .select([
              'tweet.user_id',
              knex.raw('count(tweet.id) as tweets')
            ])
            .from('tweet')
            .whereBetween('tweet.created_at', [
              knex.raw(`(now() - '${days} day'::interval)::timestamp`),
              knex.raw('now()')
            ])
            .groupBy('tweet.user_id')
            .orderBy('tweets', 'desc')
            .as('tweet')
        })
        .join('handle', 'tweet.user_id', 'handle.id')
        .join('camp', 'handle.camp_id', 'camp.id')
        .limit(limit)
        .then((handles) => handles.map((handle) => ({
          id: handle.id,
          username: handle.username,
          name: handle.name,
          profile: handle.profile,
          camp_id: handle.camp_id,
          camp: {
            id: handle.camp_id,
            name: handle.camp_name
          },
          klout_id: handle.klout_id,
          klout_score: handle.klout_score,
          tweets: +handle.tweets,
          created_at: handle.created_at,
          updated_at: handle.updated_at
        })))

      reply(handles)
    }
  })

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.applyRoutes)
  next()
}

exports.register.attributes = {
  name: 'api/analytics'
}
