'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Config = require('config')
const Deputy = require('hapi-deputy')

exports.register = function (server, options, next) {
  const Auth = server.plugins['services/auth']
  const Mail = server.plugins['services/mail']
  const Database = server.plugins['services/database']
  const Settings = server.plugins['modules/settings']

  const User = Database.model('User')

  server.route({
    method: 'POST',
    path: '/signup',
    config: {
      description: 'Create user account',
      auth: false,
      validate: {
        payload: {
          name: Joi.string(),
          email: Joi.string().email().required(),
          password: Joi.string().required(),
          confirmPassword: Joi.string().required().valid(Joi.ref('password'))
        }
      },
      pre: [{
        assign: 'signupEnabled',
        method (request, reply) {
          let promise = Settings.getValue('signup.enabled').then((enabled) => {
            if (!enabled) {
              return Boom.forbidden('Signup is disabled')
            }
          })
          reply(promise)
        }
      }, {
        assign: 'emailCheck',
        method (request, reply) {
          let email = request.payload.email

          let user = User.forge({ email: email })
            .fetch({ require: true })
            .then((user) => Boom.conflict('Email already in use'))
            .catch(User.NotFoundError, () => {})

          reply(user)
        }
      }, {
        assign: 'passwordHash',
        method (request, reply) {
          let password = request.payload.password

          let passwordHash = Auth.generatePasswordHash(password)

          reply(passwordHash)
        }
      }, {
        assign: 'user',
        method (request, reply) {
          let name = request.payload.name
          let email = request.payload.email
          let passwordHash = request.pre.passwordHash

          let user = User.forge({
            name: name,
            email: email,
            password: passwordHash
          }).save()

          reply(user)
        }
      }, {
        assign: 'session',
        method (request, reply) {
          let user = request.pre.user

          let session = Auth.createSession(user)

          reply(session)
        }
      }, {
        assign: 'token',
        method (request, reply) {
          let user = request.pre.user
          let session = request.pre.session

          let token = Auth.createToken(user, session)

          reply(token)
        }
      }]
    },
    handler (request, reply) {
      let user = request.pre.user
      let token = request.pre.token

      reply({
        user: user,
        auth: `Bearer ${token}`
      })
    }
  })

  server.route({
    method: 'POST',
    path: '/login',
    config: {
      description: 'Log in',
      auth: false,
      validate: {
        payload: {
          email: Joi.string().email().required(),
          password: Joi.string().required()
        }
      },
      pre: [{
        assign: 'user',
        method (request, reply) {
          let email = request.payload.email

          let user = User.forge({ email: email })
            .fetch({ require: true })
            .catch(User.NotFoundError, () => Boom.unauthorized())

          reply(user)
        }
      }, {
        assign: 'auth',
        method (request, reply) {
          let user = request.pre.user
          let password = request.payload.password

          let promise = Auth.authenticate(user, password)
            .then(() => user.save({ last_login_at: new Date() }))
            .catch(Auth.AuthenticationError, () => Boom.unauthorized())

          reply(promise)
        }
      }, {
        assign: 'session',
        method (request, reply) {
          let user = request.pre.user

          let session = Auth.createSession(user)

          reply(session)
        }
      }, {
        assign: 'token',
        method (request, reply) {
          let user = request.pre.user
          let session = request.pre.session

          let token = Auth.createToken(user, session)

          reply(token)
        }
      }]
    },
    handler (request, reply) {
      let user = request.pre.user
      let token = request.pre.token

      reply({
        user: user,
        auth: `Bearer ${token}`
      })
    }
  })

  server.route({
    method: 'DELETE',
    path: '/logout',
    config: {
      description: 'Destroy session',
      auth: {
        mode: 'try',
        strategy: 'jwt'
      }
    },
    handler (request, reply) {
      let credentials = request.auth.credentials || {}
      let session = credentials.session || {}

      if (!session.id) return reply()

      let promise = Auth.destroySession(session.id)
        .then(() => ({ message: 'success' }))

      reply(promise)
    }
  })

  server.route({
    method: 'POST',
    path: '/login/forgot',
    config: {
      description: 'Generate new password reset hash',
      auth: false,
      validate: {
        payload: {
          email: Joi.string().email().required()
        }
      },
      pre: [{
        assign: 'user',
        method (request, reply) {
          let email = request.payload.email

          User.forge({ email: email })
            .fetch({ require: true })
            .then(reply)
            .catch(User.NotFoundError, () => {
              reply({ message: 'success' }).takeover()
            })
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

      let promise = user.save({ password_reset: tokenHash.hash }).then((user) => {
        let template = 'forgot-password'
        let emailOptions = {
          subject: 'Reset your password',
          to: user.get('email')
        }
        let context = {
          user: user.toJSON(),
          token: tokenHash.token,
          url: Config.get('connection.front.uri')
        }
        return Mail.sendEmail(emailOptions, template, context)
      }).return({ message: 'success' })

      reply(promise)
    }
  })

  server.route({
    method: 'POST',
    path: '/login/reset',
    config: {
      description: 'Reset user password',
      auth: false,
      validate: {
        payload: {
          user: Joi.number().integer().required(),
          token: Joi.string().required(),
          password: Joi.string().required(),
          confirmPassword: Joi.string().required().valid(Joi.ref('password'))
        }
      },
      pre: [{
        assign: 'user',
        method (request, reply) {
          let userId = request.payload.user

          let user = User.forge({ id: userId })
            .fetch({ require: true })
            .catch(User.NotFoundError, () => Boom.badRequest())

          reply(user)
        }
      }, {
        assign: 'validateToken',
        method (request, reply) {
          let user = request.pre.user
          let token = request.payload.token

          let promise = Auth.validateTokenHash(user, token)
            .catch(Auth.PasswordRecoveryError, () => Boom.badRequest())

          reply(promise)
        }
      }, {
        assign: 'passwordHash',
        method (request, reply) {
          let password = request.payload.password

          let hash = Auth.generatePasswordHash(password)

          reply(hash)
        }
      }, {
        assign: 'updatePassword',
        method (request, reply) {
          let user = request.pre.user
          let hash = request.pre.passwordHash

          user = user.save({
            password: hash,
            password_reset: null
          })

          reply(user)
        }
      }, {
        assign: 'session',
        method (request, reply) {
          let user = request.pre.user

          let session = Auth.createSession(user)

          reply(session)
        }
      }, {
        assign: 'token',
        method (request, reply) {
          let user = request.pre.user
          let session = request.pre.session

          let token = Auth.createToken(user, session)

          reply(token)
        }
      }]
    },
    handler (request, reply) {
      let user = request.pre.user
      let token = request.pre.token

      reply({
        user: user,
        auth: `Bearer ${token}`
      })
    }
  })

  next()
}

exports.register.attributes = {
  name: 'api/auth',
  dependencies: [
    'services/auth',
    'services/mail',
    'services/database',
    'modules/settings'
  ]
}

module.exports = Deputy(exports)
