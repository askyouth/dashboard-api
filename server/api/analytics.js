'use strict'

// Module dependencies.
const Joi = require('joi')
const Deputy = require('hapi-deputy')
const csvWriter = require('csv-write-stream')
const { PassThrough } = require('stream')

exports.register = function (server, options, next) {
  const Database = server.plugins['services/database']

  const knex = Database.knex
  const Camp = Database.model('Camp')

  server.route({
    method: 'GET',
    path: '/analytics/klout',
    config: {
      description: 'Get Klout score changes',
      tags: ['api', 'analytics']
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
      description: 'Get top contributors',
      tags: ['api', 'analytics']
    },
    handler (request, reply) {
      let contributors = knex
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
        .from('tweet')
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
      tags: ['api', 'analytics'],
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

  server.route({
    method: 'GET',
    path: '/analytics/metrics',
    config: {
      description: 'Export metrics',
      tags: ['api', 'analytics']
    },
    async handler (request, reply) {
      let result = await knex.raw(`
        WITH metrics AS (
          SELECT
            coalesce(t.name, 'Uncategorized') topic,
            coalesce(ccc.contributions, 0)      contributions,
            coalesce(ccc.tweets, 0)             replies,
            coalesce(ccc.favorites, 0)          favorites,
            coalesce(ccc.retweets, 0)           retweets
          FROM (SELECT
                  cc.topic_id,
                  count(*)         contributions,
                  sum(cc.tweets)    tweets,
                  sum(cc.favorites) favorites,
                  sum(cc.retweets)  retweets
                FROM (SELECT
                        c.id,
                        c.topic_id,
                        c.tweets,
                        sum(tt.favorites) favorites,
                        sum(tt.retweets)  retweets
                      FROM contribution c
                        JOIN (SELECT
                                t.id,
                                t.retweets,
                                t.favorites,
                                t.contribution_id
                              FROM tweet t
                              WHERE t.contribution_id IS NOT NULL) tt ON tt.contribution_id = c.id
                      GROUP BY c.id) AS cc
                GROUP BY cc.topic_id) AS ccc FULL OUTER JOIN topic AS t ON ccc.topic_id = t.id
          ORDER BY topic ASC
        )
        SELECT *
        FROM metrics
        UNION ALL
        SELECT
          'Total',
          sum(contributions),
          sum(replies),
          sum(favorites),
          sum(retweets)
        FROM metrics;
      `)

      let csv = csvWriter()
      let pass = csv.pipe(new PassThrough({
        writableObjectMode: true
      }))

      result.rows.forEach((row) => csv.write(row))
      csv.end()

      reply(pass)
        .type('text/csv')
        .header('Content-Disposition', `attachment; filename="metrics.csv"`)
    }
  })

  next()
}

exports.register.attributes = {
  name: 'api/analytics',
  dependencies: [
    'services/database'
  ]
}

module.exports = Deputy(exports)
