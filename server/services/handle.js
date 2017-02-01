'use strict'

// Module dependencies.
const perioda = require('perioda')
const Promise = require('bluebird')
const _ = require('lodash')

const internals = {}

internals.dependencies = [
  'database',
  'settings',
  'services/klout',
  'services/twitter'
]

internals.init = (server, next) => {
  const log = server.log.bind(server, ['services', 'handle'])
  const Klout = server.plugins['services/klout']
  const Twitter = server.plugins['services/twitter']
  const Settings = server.plugins.settings
  const Database = server.plugins.database
  const Handle = Database.model('Handle')
  const Camp = Database.model('Camp')

  const campSettingsMap = {
    [Camp.YOUTH]: 'twitter.list.youth',
    [Camp.POLICY_MAKER]: 'twitter.list.policymakers'
  }

  fetchBrokerHandle()
  const task = perioda(syncHandles, 60 * 1000).start()
  task.on('error', (err) => log(`sync error: ${err.message}`))

  function fetchBrokerHandle () {
    return Handle.forge({ camp_id: Camp.BROKER })
      .fetch({ require: true })
      .catch(Handle.NotFoundError, () => {
        return Twitter.verifyCredentials()
          .then((profile) => createFromTwitterProfile(profile, Camp.BROKER))
          .tap((handle) => Twitter.follow(handle.get('id')))
      })
      .catch((err) => log(`error fetching broker: ${err.message}`))
  }

  function syncList (id, camp) {
    return Twitter.listMembers({ list_id: id }).then((members) => {
      let memberIds = members.map((member) => member.id_str)
      return Handle.collection()
        .query((qb) => qb.whereIn('id', memberIds))
        .fetch()
        .then((handles) => handles.pluck('id'))
        .then((handleIds) => members.filter((member) => !~handleIds.indexOf(member.id_str)))
        .then((members) => Promise.map(members,
          (member) => createFromTwitterProfile(member, camp),
          { concurrency: 3 }
        ))
    })
  }

  function syncHandles () {
    let settingsProps = ['twitter.list.youth', 'twitter.list.policymakers']
    return Settings.get(settingsProps).then((settings) => {
      let jobs = []
      let youthListId = settings['twitter.list.youth']
      let pmListId = settings['twitter.list.policymakers']
      if (youthListId) jobs.push(syncList(youthListId, Camp.YOUTH))
      if (pmListId) jobs.push(syncList(pmListId, Camp.POLICY_MAKER))
      return Promise.all(jobs)
    })
  }

  function prepareQuery (query) {
    query || (query = {})
    return Handle.query((qb) => {
      if (query.camp) {
        qb.where('handle.camp_id', '=', query.camp)
      } else {
        qb.where('handle.camp_id', '!=', Camp.BROKER)
      }
      if (query.topic) {
        qb.innerJoin('handle_topic', 'handle.id', 'handle_topic.handle_id')
        qb.groupBy('handle.id')
        qb.where('handle_topic.topic_id', query.topic)
      }
      if (query.search) {
        qb.where(function () {
          this.where('handle.username', 'ilike', `%${query.search}%`)
            .orWhere('handle.name', 'ilike', `%${query.search}%`)
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

  function create (data) {
    return Klout.getIdentity(data.username)
      .then((klout) => {
        data = Object.assign({ klout_id: klout.id }, data)
        return Handle.forge(data).save(null, { method: 'insert' })
      })
  }

  function createFromTwitterProfile (profile, campId) {
    return create({
      id: profile.id_str,
      username: profile.screen_name,
      name: profile.name,
      profile: {
        image: profile.profile_image_url_https,
        description: profile.description
      },
      camp_id: campId
    })
  }

  function addToTwitterList (handle) {
    let listKey = campSettingsMap[handle.get('camp_id')]
    if (!listKey) return Promise.resolve()
    return Settings.getValue(listKey).then((listId) => {
      if (!listId) return
      return Twitter.listAddMember(listId, handle.get('id'))
    })
  }

  function removeFromTwitterList (handle) {
    let listKey = campSettingsMap[handle.get('camp_id')]
    if (!listKey) return Promise.resolve()
    return Settings.getValue(listKey).then((listId) => {
      if (!listId) return
      return Twitter.listRemoveMember(listId, handle.get('id'))
        .catch(Twitter.TwitterError, (err) => {
          // user not on the list
          if (err.code !== 110) throw err
        })
    })
  }

  server.expose('fetch', fetch)
  server.expose('count', count)
  server.expose('create', create)
  server.expose('createFromTwitterProfile', createFromTwitterProfile)
  server.expose('addToTwitterList', addToTwitterList)
  server.expose('removeFromTwitterList', removeFromTwitterList)

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.init)
  next()
}

exports.register.attributes = {
  name: 'services/handle',
  dependencies: internals.dependencies
}
