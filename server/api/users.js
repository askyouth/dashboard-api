'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Config = require('config')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')

exports.register = function (server, options, next) {
  const Mail = server.plugins['services/mail']
  const Auth = server.plugins['services/auth']
  const Database = server.plugins['services/database']
  const Users = server.plugins['modules/user']

  const User = Database.model('User')

  function loadUser (request, reply) {
    let userId = request.params.userId
    let user = User.forge({ id: userId })
      .fetch({ require: true })
      .catch(User.NotFoundError, () => Boom.notFound('User not found'))

    reply(user)
  }

  server.route({
    method: 'GET',
    path: '/users',
    config: {
      description: 'Get list of users',
      tags: ['api', 'users'],
      validate: {
        query: {
          filter: Joi.object({
            search: Joi.string()
          }).default({}),
          page: Joi.number().integer().default(1),
          pageSize: Joi.number().integer().default(20),
          sort: Joi.string().valid(['name', 'email', 'created_at', 'last_login_at']).default('name'),
          sortOrder: Joi.string().valid(['asc', 'desc']).default('asc')
        }
      }
    },
    handler (request, reply) {
      let filter = request.query.filter
      let page = request.query.page
      let pageSize = request.query.pageSize
      let sort = request.query.sort
      let sortOrder = request.query.sortOrder

      let result = Promise.props({
        users: Users.fetch(filter, {
          sortBy: sort,
          sortOrder: sortOrder,
          page: page,
          pageSize: pageSize
        }),
        count: Users.count(filter)
      })

      reply(result)
    }
  })

  server.route({
    method: 'POST',
    path: '/users',
    config: {
      description: 'Create new user',
      tags: ['api', 'users'],
      validate: {
        payload: {
          name: Joi.string(),
          email: Joi.string().email().required()
        }
      },
      pre: [{
        assign: 'emailCheck',
        method (request, reply) {
          let email = request.payload.email

          let user = User.forge({ email })
            .fetch({ require: true })
            .then((user) => Boom.badRequest('Email already in use'))
            .catch(User.NotFoundError, () => {})

          reply(user)
        }
      }, {
        assign: 'passwordHash',
        method (request, reply) {
          let password = Auth.generateTokenHash()
            .then((token) => token.hash)

          reply(password)
        }
      }, {
        assign: 'user',
        method (request, reply) {
          let name = request.payload.name
          let email = request.payload.email
          let password = request.pre.passwordHash

          let user = User.forge({
            name: name,
            email: email,
            password: password
          }).save()

          reply(user)
        }
      }, {
        assign: 'tokenHash',
        method (request, reply) {
          let resetToken = Auth.generateTokenHash()
          reply(resetToken)
        }
      }]
    },
    handler (request, reply) {
      let user = request.pre.user
      let tokenHash = request.pre.tokenHash
      let credentials = request.auth.credentials

      let promise = user.save({ password_reset: tokenHash.hash })
        .tap((user) => {
          let template = 'set-password'
          let emailOptions = {
            subject: 'Set your password',
            to: user.get('email')
          }
          let context = {
            user: user.toJSON(),
            credentials: credentials,
            token: tokenHash.token,
            url: Config.get('connection.front.uri')
          }
          return Mail.sendEmail(emailOptions, template, context)
        })

      reply(promise)
    }
  })

  server.route({
    method: 'GET',
    path: '/users/{userId}',
    config: {
      description: 'Get user',
      tags: ['api', 'users'],
      validate: {
        params: {
          userId: Joi.number().integer().required()
        }
      },
      pre: [{
        method: loadUser, assign: 'user'
      }]
    },
    handler (request, reply) {
      let user = request.pre.user
      reply(user)
    }
  })

  server.route({
    method: 'DELETE',
    path: '/users/{userId}',
    config: {
      description: 'Delete user',
      tags: ['api', 'users'],
      validate: {
        params: {
          userId: Joi.number().integer().required()
        }
      },
      pre: [{
        method: loadUser, assign: 'user'
      }]
    },
    handler (request, reply) {
      let user = request.pre.user

      let promise = user.destroy()

      reply(promise).code(204)
    }
  })

  next()
}

exports.register.attributes = {
  name: 'api/users',
  dependencies: [
    'services/auth',
    'services/mail',
    'services/database',
    'modules/user'
  ]
}

module.exports = Deputy(exports)
