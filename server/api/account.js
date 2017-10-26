'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')
const _ = require('lodash')

exports.register = function (server, options, next) {
  const Auth = server.plugins['services/auth']
  const Database = server.plugins['services/database']
  const Handles = server.plugins['modules/handle']
  const Contributions = server.plugins['modules/contribution']

  const User = Database.model('User')
  const Camp = Database.model('Camp')

  server.route({
    method: 'GET',
    path: '/profile',
    config: {
      description: 'Get profile information and system stats',
      tags: ['api', 'account']
    },
    handler (request, reply) {
      let data = Promise.props({
        handle: Handles.fetch({ camp: Camp.BROKER }),
        youthHandles: Handles.count({ camp: Camp.YOUTH }),
        policyMakerHandles: Handles.count({ camp: Camp.POLICY_MAKER }),
        contributions: Contributions.count()
      })

      reply(data)
    }
  })

  server.route({
    method: 'POST',
    path: '/profile',
    config: {
      description: 'Update account',
      tags: ['api', 'account'],
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
            .catch(Auth.AuthenticationError, () => Boom.badRequest('Invalid password'))

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

exports.register.attributes = {
  name: 'api/account',
  dependencies: [
    'services/auth',
    'services/database',
    'modules/handle',
    'modules/contribution'
  ]
}

module.exports = Deputy(exports)
