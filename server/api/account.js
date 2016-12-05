'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Errors = require('../errors')
const Promise = require('bluebird')
const _ = require('lodash')

const AuthenticationError = Errors.AuthenticationError

const internals = {}

internals.dependencies = [
  'database',
  'auth',
  'services/handle'
]

internals.applyRoutes = (server, next) => {
  const Auth = server.plugins.auth
  const Handle = server.plugins['services/handle']
  const Contribution = server.plugins['services/contribution']
  const Database = server.plugins.database
  const User = Database.model('User')
  const Camp = Database.model('Camp')

  server.route({
    method: 'GET',
    path: '/account',
    config: {
      description: 'Get account information and system stats'
    },
    handler (request, reply) {
      let data = Promise.props({
        handle: Handle.fetch({ camp: Camp.BROKER }),
        youthHandles: Handle.count({ camp: Camp.YOUTH }),
        policyMakerHandles: Handle.count({ camp: Camp.POLICY_MAKER }),
        contributions: Contribution.count()
      })

      reply(data)
    }
  })

  server.route({
    method: 'POST',
    path: '/profile',
    config: {
      description: 'Update account',
      auth: 'jwt',
      validate: {
        payload: Joi.object({
          name: Joi.string(),
          password: Joi.string(),
          confirmPassword: Joi.string().valid(Joi.ref('password')),
          currentPassword: Joi.string()
        }).with('password', 'confirmPassword', 'currentPassword')
      },
      pre: [{
        assign: 'user',
        method (request, reply) {
          let userId = request.auth.credentials.user.id
          let user = User.forge({ id: userId })
            .fetch({ require: true })

          reply(user)
        }
      }, {
        assign: 'checkPassword',
        method (request, reply) {
          if (!request.payload.password) return reply()
          let user = request.pre.user
          let currentPassword = request.payload.currentPassword

          let promise = Auth.authenticate(user, currentPassword)
            .catch(AuthenticationError, () => Boom.badRequest('Invalid password'))

          reply(promise)
        }
      }, {
        assign: 'passwordHash',
        method (request, reply) {
          let password = request.payload.password
          if (!password) return reply()
          reply(Auth.generatePasswordHash(password))
        }
      }]
    },
    handler (request, reply) {
      let user = request.pre.user
      let passwordHash = request.pre.passwordHash
      let changes = _.pick(request.payload, ['name'])
      if (passwordHash) changes.password = passwordHash

      user = user.save(changes)

      reply(user)
    }
  })

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.applyRoutes)
  next()
}

exports.register.attributes = {
  name: 'api/account',
  dependencies: internals.dependencies
}
