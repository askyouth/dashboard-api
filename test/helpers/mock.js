'use strict'

// Module dependencies.
const nock = require('nock')

const kloutIdentity = require('./mocks/klout_identity.json')
const twitterProfile = require('./mocks/twitter_profile.json')

nock.disableNetConnect()

exports = module.exports = nock

exports.kloutIdentity = (user) => {
  let response = Object.assign({}, kloutIdentity, user)

  return nock('http://api.klout.com:80', { encodedQueryParams: true })
    .get('/v2/identity.json/twitter')
    .query({
      screenName: user.screen_name,
      key: 'abc'
    })
    .reply(200, response, {
      'content-type': 'application/json; charset=utf-8',
      'x-mashery-responder': 'prod-j-worker-us-west-1c-59.mashery.com',
      'x-plan-qps-allotted': '10',
      'x-plan-qps-current': '1',
      'x-plan-quota-allotted': '20000',
      'x-plan-quota-current': '27',
      'x-plan-quota-reset': 'Saturday, October 1, 2016 12:00:00 AM GMT'
    })
}

exports.kloutIdentityNotFound = () => {
  return nock('http://api.klout.com:80', { encodedQueryParams: true })
    .get('/v2/identity.json/twitter')
    .query((query) => true)
    .reply(404, '', {
      'x-mashery-responder': 'prod-j-worker-us-west-1b-64.mashery.com',
      'x-plan-qps-allotted': '10',
      'x-plan-qps-current': '1',
      'x-plan-quota-allotted': '20000',
      'x-plan-quota-current': '35',
      'x-plan-quota-reset': 'Saturday, October 1, 2016 12:00:00 AM GMT'
    })
}

exports.twitterProfile = (user) => {
  let response = Object.assign({}, twitterProfile, user)
  return nock('https://api.twitter.com:443', { encodedQueryParams: true })
    .get('/1.1/users/show.json')
    .query({
      screen_name: user.screen_name,
      include_entities: 'false'
    })
    .reply(200, response, {
      'content-type': 'application/json;charset=utf-8',
      'x-access-level': 'read',
      'x-connection-hash': 'f6d92161438fed0b9cd90f6e3b9915dd',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-rate-limit-limit': '181',
      'x-rate-limit-remaining': '180',
      'x-rate-limit-reset': '1475236019',
      'x-response-time': '42',
      'x-transaction': '009f587100b8fba6',
      'x-twitter-response-tags': 'BouncerCompliant',
      'x-xss-protection': '1; mode=block'
    })
}
