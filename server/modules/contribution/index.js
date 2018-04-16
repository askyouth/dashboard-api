'use strict'

// Module dependencies.
const Evaluator = require('./evaluator')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')
const _ = require('lodash')

exports.register = function (server, options, next) {
  const Database = server.plugins['services/database']

  const Camp = Database.model('Camp')
  const Contribution = Database.model('Contribution')

  const engine = new Evaluator()
  const log = server.log.bind(server, ['modules', 'contribution'])

  const Handles = {
    store: {
      [Camp.BROKER]: new Set(),
      [Camp.YOUTH]: new Set(),
      [Camp.POLICY_MAKER]: new Set()
    },
    async init () {
      let handles = await Database.knex('handle')
        .whereIn('camp_id', Object.keys(this.store))
        .select(['id', 'camp_id'])

      handles.forEach(({ id, camp_id }) => this.add(camp_id, id))
    },
    add (camp, id) {
      this.store[camp].add(id)
    },
    delete (camp, id) {
      this.store[camp].delete(id)
    },
    has (id) {
      for (let ids of Object.values(this.store)) {
        if (ids.has(id)) return true
      }
      return false
    },
    camp (id) {
      for (let [camp, ids] of Object.entries(this.store)) {
        if (ids.has(id)) return +camp
      }
    }
  }

  Handles.init().catch((err) => log(`error init handles: ${err.message}`))

  // check if tweet is candidate for contribution:
  //   broker tweets mentioning both youth or policy maker
  //   broker replies to anyone mentioning both youth or policy maker
  //   broker replies to youth/pm mentioning pm/youth
  //   youth/pm tweets mentioning broker and pm/youth
  //
  // check if tweet is part of existing contribution
  // create new contribution with this tweet

  engine.addRule({
    description: 'Check if tweet has parent and fetch it',
    match: ({ tweet }) => tweet.has('parent_id'),
    action: async ({ tweet }) => ({
      parent: await tweet.related('parent').fetch()
    })
  })

  engine.addRule({
    description: 'Check if tweet is reply to contribution and fetch it',
    match: ({ parent }) => parent.has('contribution_id'),
    action: async ({ parent }) => ({
      contribution: await parent.related('contribution').fetch()
    })
  })

  engine.addRule({
    description: 'Check if tweet author is handle',
    match: ({ tweet }) => Handles.has(tweet.get('user_id')),
    action: ({ tweet }) => ({
      handle: Object.assign({
        camp: Handles.camp(tweet.get('user_id'))
      }, tweet.get('user'))
    })
  })

  engine.addRule({
    description: 'If not part of existing contribution, extract mentions',
    match: '!contribution',
    action: ({ tweet }) => ({
      mentions: tweet.get('entities').user_mentions
        .map((mention) => Object.assign({
          camp: Handles.camp(mention.id)
        }, mention))
    })
  })

  engine.addRule({
    description: 'Check if tweet author is Broker',
    match: 'handle.camp',
    action: ({ handle: { camp } }) => ({
      authorBroker: (camp === Camp.BROKER)
    })
  })

  engine.addRule({
    description: 'Check if tweet author is Policy Maker',
    match: 'handle.camp',
    action: ({ handle: { camp } }) => ({
      authorPolicyMaker: (camp === Camp.POLICY_MAKER)
    })
  })

  engine.addRule({
    description: 'Check if tweet author is Youth',
    match: 'handle.camp',
    action: ({ handle: { camp } }) => ({
      authorYouth: (camp === Camp.YOUTH)
    })
  })

  engine.addRule({
    description: 'Check if tweet mentions Broker',
    match: 'mentions',
    action: ({ mentions }) => ({
      mentionsBroker: !!mentions.find(({ camp }) => (camp === Camp.BROKER))
    })
  })

  engine.addRule({
    description: 'Check if tweet mentions any Policy Maker handles',
    match: 'mentions',
    action: ({ mentions }) => ({
      mentionsPolicyMaker: !!mentions.find(({ camp }) => (camp === Camp.POLICY_MAKER))
    })
  })

  engine.addRule({
    description: 'Check if tweet mentions any Youth handles',
    match: 'mentions',
    action: ({ mentions }) => ({
      mentionsYouth: !!mentions.find(({ camp }) => (camp === Camp.YOUTH))
    })
  })

  engine.addRule({
    description: 'If tweet author is broker and it mentions pm and youth, it is a contribution',
    match: ['authorBroker', 'mentionsPolicyMaker', 'mentionsYouth'],
    action: (ctx) => ({
      newContribution: true
    })
  })

  engine.addRule({
    description: 'If tweet author is policy maker and it mentions broker and youth, it is a contribution',
    match: ['authorPolicyMaker', 'mentionsYouth', 'mentionsBroker'],
    action: (ctx) => ({
      newContribution: true
    })
  })

  engine.addRule({
    description: 'If tweet author is youth and it mentions broker and policy maker, it is a contribution',
    match: ['authorYouth', 'mentionsPolicyMaker', 'mentionsBroker'],
    action: (ctx) => ({
      newContribution: true
    })
  })

  engine.addRule({
    description: 'Check if tweet is starts new contribution and create one',
    match: 'newContribution',
    action: async ({ tweet, handle: { camp } = {}, authorYouth, authorPolicyMaker }) => ({
      contribution: await Contribution.forge({
        tweet_id: tweet.get('id'),
        camp_id: camp,
        involves_pm: authorPolicyMaker === true,
        involves_youth: authorYouth === true,
        tweets: 0,
        contributors: []
      }).save()
    })
  })

  engine.addRule({
    description: 'If tweet is part of contribution, update contribution',
    match: 'contribution',
    action: async ({ tweet, contribution, handle: { screen_name }, authorYouth, authorPolicyMaker }) => {
      let contributors = contribution.get('contributors').concat([screen_name])
      tweet.set('contribution_id', contribution.get('id'))
      contribution.set('tweets', contribution.get('tweets') + 1)
      contribution.set('contributors', _.uniq(contributors))
      if (authorYouth) contribution.set('involves_youth', true)
      if (authorPolicyMaker) contribution.set('involves_pm', true)

      await Promise.join(tweet.save(), contribution.save())
    }
  })

  function process (tweet) {
    return engine.run({ tweet: tweet })
      .then((result) => result.contribution)
  }

  function prepareQuery (query) {
    query || (query = {})

    let cond = {
      eq: '=',
      min: '>=',
      max: '<='
    }

    return Contribution.query((qb) => {
      if (query.campId) {
        qb.where('camp_id', query.campId)
      }
      if (query.topicId) {
        qb.where('topic_id', query.topicId)
      }
      if (query.conversationsOnly) {
        qb.where(function () {
          this.where('involves_pm', true)
            .andWhere('involves_youth', true)
        })
      }
      if (query.tweets) {
        qb.where('tweets', cond[query.tweetsCondition], query.tweets)
      }
      if (query.contributors) {
        let predicate = Database.knex.raw('array_length(contributors, 1)')
        qb.where(predicate, cond[query.contributorsCondition], query.contributors)
      }
      if (query.search) {
        qb.innerJoin('tweet', 'tweet.contribution_id', 'contribution.id')
        qb.groupBy('contribution.id')
        qb.where(function () {
          this.where('tweet.text', 'ilike', `%${query.search}%`)
            .orWhereRaw('tweet.user->>\'name\' ilike ?', `%${query.search}%`)
            .orWhereRaw('tweet.user->>\'screen_name\' ilike ?', `%${query.search}%`)
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

  function count (query) {
    return prepareQuery(query)
      .count()
      .then((count) => +count)
  }

  function handleCreated ({ id, camp_id: campId }) {
    Handles.add(campId, id)
  }

  function handleRemoved ({ id, camp_id: campId }) {
    Handles.delete(campId, id)
  }

  server.expose('process', process)
  server.expose('fetch', fetch)
  server.expose('count', count)
  server.expose('handleCreated', handleCreated)
  server.expose('handleRemoved', handleRemoved)

  next()
}

exports.register.attributes = {
  name: 'modules/contribution',
  dependencies: [
    'services/database'
  ]
}

module.exports = Deputy(exports)
