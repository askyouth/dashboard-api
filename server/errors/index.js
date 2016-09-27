'use strict'

// Module dependencies.
const Boom = require('boom')

const internals = {}

internals.wrapDatabaseError = function (request, reply) {
  let response = request.response
  if (!response.isBoom) {
    return reply.continue()
  }
  if (response.name === 'error' && response.code === '23505') {
    return reply(Boom.badRequest(response.message, response.detail))
  }
  return reply.continue()
}

exports.register = function (server, options, next) {
  server.ext('onPreResponse', internals.wrapDatabaseError)

  next()
}

exports.register.attributes = {
  name: 'errors',
  dependencies: ['database']
}
