'use strict'

// Module dependencies.

const internals = {}

internals.dependencies = [
  'database'
]

internals.init = (server, next) => {
  const Database = server.plugins.database
  const Settings = Database.model('Settings')

  function get (keys) {
    keys || (keys = [])
    return Settings.collection()
      .query((qb) => {
        if (keys.length) qb.whereIn('name', keys)
      })
      .fetch()
      .then(parseSettings)
  }

  function set (hash) {
    let keys = Object.keys(hash)
    return Settings.collection()
      .query((qb) => qb.whereIn('name', keys))
      .fetch()
      .then((settings) => {
        settings || (settings = Settings.collection())
        settings.forEach((setting) => {
          setting.set({
            type: toType(hash[setting.get('name')]),
            value: toString(hash[setting.get('name')])
          })
          keys.splice(keys.indexOf(setting.get('name')), 1)
        })
        keys.forEach((key) => settings.add({
          name: key,
          type: toType(hash[key]),
          value: toString(hash[key])
        }))
        return settings.invokeThen('save')
      })
      .then(parseSettings)
  }

  function getValue (key) {
    return get([key]).then((settings) => settings[key])
  }

  function setValue (key, val) {
    return set({ key: val })
  }

  function parseSettings (settings) {
    return settings.reduce((memo, setting) => {
      memo[setting.get('name')] = toValue(setting.get('value'), setting.get('type'))
      return memo
    }, {})
  }

  function toString (val) {
    if (typeof val === 'string') return val
    return JSON.stringify(val)
  }

  function toValue (str, type) {
    if (type === 'string') return str
    return JSON.parse(str)
  }

  function toType (val) {
    return Object.prototype.toString.call(val).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
  }

  server.expose('get', get)
  server.expose('set', set)
  server.expose('getValue', getValue)
  server.expose('setValue', setValue)

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.init)
  next()
}

exports.register.attributes = {
  name: 'settings',
  dependencies: internals.dependencies
}
