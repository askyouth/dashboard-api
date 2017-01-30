'use strict'

// Module dependencies.

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
      let handles = knex('klout_score')
        .select([
          knex.raw('distinct on (handle.id) handle.id'),
          'handle.username',
          'handle.name',
          'handle.profile',
          'handle.camp_id',
          'camp.name as camp_name',
          'handle.klout_id',
          'handle.klout_score',
          'klout_score.delta_week'
        ])
        .join('handle', 'klout_score.handle_id', 'handle.id')
        .join('camp', 'handle.camp_id', 'camp.id')
        .whereNot('handle.camp_id', Camp.BROKER)
        .whereBetween('klout_score.created_at', [
          knex.raw('(now() - \'7 day\'::interval)::timestamp'),
          knex.raw('now()')
        ])
        .orderBy(['handle.id', 'klout_score.id'], 'desc')
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
          klout_delta: handle.delta_week,
          created_at: handle.created_at,
          updated_at: handle.updated_at
        })))

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
      description: 'Get most active users'
    },
    handler (request, reply) {
      let handles = knex('tweet')
        .select([
          'handle.id',
          'handle.username',
          'handle.name',
          'handle.profile',
          'handle.camp_id',
          'camp.name as camp_name',
          'handle.klout_id',
          'handle.klout_score',
          knex.raw('count(tweet.id) as tweets')
        ])
        .join('handle', 'tweet.user_id', 'handle.id')
        .join('camp', 'handle.camp_id', 'camp.id')
        .whereBetween('tweet.created_at', [
          knex.raw('(now() - \'7 day\'::interval)::timestamp'),
          knex.raw('now()')
        ])
        .groupBy('handle.id', 'camp.id')
        .orderBy('tweets', 'desc')
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
