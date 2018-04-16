'use strict'

// Module dependencies.
const Joi = require('joi')
const JWT = require('jsonwebtoken')
const Uuid = require('node-uuid')
const Errors = require('./errors')
const Bcrypt = require('bcrypt')
const Deputy = require('hapi-deputy')
const Promise = require('bluebird')

const AuthenticationError = Errors.AuthenticationError
const PasswordRecoveryError = Errors.PasswordRecoveryError

exports.validate = {
  schema: {
    secret: Joi.string().required()
  },
  message: 'Invalid auth configuration.'
}

exports.register = function (server, options, next) {
  const Database = server.plugins['services/database']

  const Session = Database.model('Session')

  server.auth.strategy('jwt', 'jwt', {
    key: options.secret,
    validateFunc: validate,
    verifyOptions: {
      algorithms: ['HS256']
    }
  })

  server.auth.default('jwt')

  function validate (token, request, cb) {
    Session.forge({ id: token.sid })
      .query('where', 'valid_to', null)
      .fetch({ withRelated: ['user'] })
      .then((session) => {
        if (!session) return cb(null, false)
        cb(null, true, {
          session: session.toJSON(),
          user: session.related('user').toJSON()
        })
      })
  }

  function generatePasswordHash (password) {
    return Promise.resolve(Bcrypt.hash(password, 10))
  }

  function authenticate (user, password) {
    let passwordHash = user.get('password')
    return Promise.resolve(Bcrypt.compare(password, passwordHash).then((res) => {
      if (!res) throw new AuthenticationError()
    }))
  }

  function createSession (user) {
    return Session.forge({
      user_id: user.get('id'),
      valid_from: new Date()
    }).save()
  }

  function destroySession (sessionId) {
    return Session.forge({ id: sessionId })
      .save({ valid_to: new Date() }, {
        patch: true,
        validate: false
      })
      .return()
  }

  function createToken (user, session) {
    return JWT.sign({
      uid: user.get('id'),
      sid: session.get('id')
    }, options.secret)
  }

  function generateTokenHash () {
    let token = Uuid.v4()

    return Promise.resolve(Bcrypt.hash(token, 10).then((hash) => ({
      token: token,
      hash: hash
    })))
  }

  function validateTokenHash (user, token) {
    return Promise.resolve(Bcrypt.compare(token, user.get('password_reset')).then((res) => {
      if (!res) throw new PasswordRecoveryError()
    }))
  }

  server.expose('authenticate', authenticate)
  server.expose('createSession', createSession)
  server.expose('destroySession', destroySession)
  server.expose('createToken', createToken)
  server.expose('generateTokenHash', generateTokenHash)
  server.expose('validateTokenHash', validateTokenHash)
  server.expose('generatePasswordHash', generatePasswordHash)

  server.expose('AuthenticationError', AuthenticationError)
  server.expose('PasswordRecoveryError', PasswordRecoveryError)

  next()
}

exports.register.attributes = {
  name: 'services/auth',
  dependencies: [
    'services/database'
  ]
}

module.exports = Deputy(exports)
