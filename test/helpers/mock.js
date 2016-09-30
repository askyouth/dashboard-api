'use strict'

// Module dependencies.
const nock = require('nock')

const twitterProfile = require('./mocks/twitter_profile.json')

nock.disableNetConnect()

exports = module.exports = nock

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
