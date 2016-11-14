'use strict'

// Module dependencies.
const Evaluator = require('./evaluator')
const Promise = require('bluebird')
const _ = require('lodash')

const internals = {}

internals.dependencies = ['database']

exports.register = function (server, options, next) {
  const Database = server.plugins.database
  const Camp = Database.model('Camp')
  const Handle = Database.model('Handle')
  const Contribution = Database.model('Contribution')
  const engine = new Evaluator()

  // check if tweet is candidate for contribution:
  //   broker tweets mentioning both youth or policy maker
  //   broker replies to anyone mentioning both youth or policy maker
  //   broker replies to youth/pm mentioning pm/youth
  //   youth/pm tweets mentioning broker and pm/youth
  //
  // check if tweet is part of existing contribution
  // create new contribution with this tweet

  engine.addRule({
    description: 'If tweet has parent, fetch parent',
    match: ['tweet', (ctx) => ctx.tweet.related('parent').fetch()],
    action: (ctx) => ({
      parent: ctx.tweet.related('parent')
    })
  })

  engine.addRule({
    description: 'If tweet is reply to contribution, fetch contribution',
    match: ['parent', (ctx) => ctx.parent.related('contribution').fetch()],
    action: (ctx) => ({
      contribution: ctx.parent.related('contribution')
    })
  })

  engine.addRule({
    description: 'If tweet author is in database, fetch handle',
    match: ['tweet', (ctx) => ctx.tweet.related('handle').fetch()],
    action: (ctx) => ({
      handle: ctx.tweet.related('handle')
    })
  })

  engine.addRule({
    description: 'If handle is loaded, fetch mentioned handles',
    match: ['tweet', '!contribution'],
    action: (ctx) => {
      let mentions = _.map(ctx.tweet.get('entities').user_mentions, 'id')
      return Handle.collection()
        .query('whereIn', 'id', mentions)
        .fetch({ require: true })
        .then((handles) => ({ mentions: handles }))
    }
  })

  engine.addRule({
    description: 'If tweet author is broker, assign flag to context',
    match: ['handle', (ctx) => ctx.handle.get('camp_id') === Camp.BROKER],
    action: (ctx) => ({ authorBroker: true })
  })

  engine.addRule({
    description: 'If tweet author is policy maker, assign flag to context',
    match: ['handle', (ctx) => ctx.handle.get('camp_id') === Camp.POLICY_MAKER],
    action: (ctx) => ({ authorPolicyMaker: true })
  })

  engine.addRule({
    description: 'If tweet author is youth, assign flag to context',
    match: ['handle', (ctx) => ctx.handle.get('camp_id') === Camp.YOUTH],
    action: (ctx) => ({ authorYouth: true })
  })

  engine.addRule({
    description: 'If tweet mentions broker, assign flag to context',
    match: ['mentions', (ctx) => !!~ctx.mentions.pluck('camp_id').indexOf(Camp.BROKER)],
    action: (ctx) => ({ mentionsBroker: true })
  })

  engine.addRule({
    description: 'If tweet mentions any pm handles, assign to context',
    match: ['mentions', (ctx) => !!~ctx.mentions.pluck('camp_id').indexOf(Camp.POLICY_MAKER)],
    action: (ctx) => ({ mentionsPolicyMaker: true })
  })

  engine.addRule({
    description: 'If tweet mentions any youth handles, assign to context',
    match: ['mentions', (ctx) => !!~ctx.mentions.pluck('camp_id').indexOf(Camp.YOUTH)],
    action: (ctx) => ({ mentionsYouth: true })
  })

  engine.addRule({
    description: 'If tweet author is broker and it mentions pm and youth, it is a contribution',
    match: ['authorBroker', 'mentionsPolicyMaker', 'mentionsYouth'],
    action: (ctx) => ({ isContribution: true })
  })

  engine.addRule({
    description: 'If tweet author is policy maker and it mentions broker and youth, it is a contribution',
    match: ['authorPolicyMaker', 'mentionsYouth', 'mentionsBroker'],
    action: (ctx) => ({ isContribution: true })
  })

  engine.addRule({
    description: 'If tweet author is youth and it mentions broker and policy maker, it is a contribution',
    match: ['authorYouth', 'mentionsPolicyMaker', 'mentionsBroker'],
    action: (ctx) => ({ isContribution: true })
  })

  engine.addRule({
    description: 'If tweet is starts new contribution, create contribution',
    match: 'isContribution',
    action: (ctx) => {
      return Contribution.forge({
        tweet_id: ctx.tweet.get('id'),
        camp_id: ctx.handle ? ctx.handle.get('camp_id') : null,
        involves_pm: ctx.authorPolicyMaker === true,
        involves_youth: ctx.authorYouth === true,
        tweets: 0,
        contributors: []
      }).save().then((contribution) => ({
        contribution: contribution
      }))
    }
  })

  engine.addRule({
    description: 'If tweet is part of contribution, update contribution',
    match: 'contribution',
    action: (ctx) => {
      let tweet = ctx.tweet
      let contribution = ctx.contribution
      let contributors = contribution.get('contributors').concat([tweet.get('user').screen_name])
      tweet.set('contribution_id', contribution.get('id'))
      contribution.set('tweets', contribution.get('tweets') + 1)
      contribution.set('contributors', _.uniq(contributors))
      if (ctx.authorYouth) contribution.set('involves_youth', true)
      if (ctx.authorPolicyMaker) contribution.set('involves_pm', true)
      return Promise.join(tweet.save(), contribution.save())
        .return({ contribution: contribution })
    }
  })

  function process (tweet) {
    return engine.run({ tweet: tweet })
      .then((result) => result.contribution)
  }

  server.expose('process', process)

  next()
}

exports.register.attributes = {
  name: 'services/contribution',
  dependencies: internals.dependencies
}
