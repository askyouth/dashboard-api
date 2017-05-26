'use strict'

// Module dependencies.
const Promise = require('bluebird')

const matchers = {
  '!': (v) => !v,
  '': (v) => !!v
}

function prepareMatch (match) {
  if (typeof match === 'string') {
    let r = match.match(/^(!?)(.+)$/)
    return (ctx) => matchers[r[1]](ctx[r[2]])
  }
  return match
}

class Rule {
  constructor (options) {
    let match = Array.isArray(options.match)
      ? options.match
      : [options.match]
    this._match = match.map(prepareMatch)
    this._action = options.action
    this._description = options.description
  }

  match (ctx) {
    return Promise.reduce(this._match, (memo, cond) => {
      return memo && Promise.try(cond.bind(null, ctx))
        .then((result) => !!result)
        .catch(() => false)
    }, true)
  }

  exec (ctx) {
    return Promise.try(this._action.bind(null, ctx))
  }

  describe () {
    return this._description
  }
}

class Evaluator {
  constructor () {
    this.rules = []
  }

  addRule (rule) {
    this.rules.push(new Rule(rule))
  }

  run (ctx) {
    return Promise.reduce(this.rules, (ctx, rule) => {
      return rule.match(ctx).then((result) => {
        if (!result) return ctx
        return rule.exec(ctx).then((result) => {
          return Object.assign(ctx, result)
        })
      }).catch(() => ctx)
    }, ctx)
  }
}

module.exports = Evaluator
