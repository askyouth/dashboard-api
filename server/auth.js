'use strict'

// Module dependencies.
const Joi = require('joi')
const JWT = require('jsonwebtoken')
const Uuid = require('node-uuid')
const Errors = require('./errors')
const Bcrypt = require('bcrypt')

const AuthenticationError = Errors.AuthenticationError
const PasswordRecoveryError = Errors.PasswordRecoveryError

const internals = {}

internals.dependencies = ['database']

internals.applyStrategy = (server, options, next) => {
  const Database = server.plugins.database
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
    return Bcrypt.hash(password, 10)
  }

  function authenticate (user, password) {
    let passwordHash = user.get('password')
    return Bcrypt.compare(password, passwordHash).then((res) => {
      if (!res) throw new AuthenticationError()
    })
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

    return Bcrypt.hash(token, 10).then((hash) => ({
      token: token,
      hash: hash
    }))
  }

  function validateTokenHash (user, token) {
    return Bcrypt.compare(token, user.get('password_reset')).then((res) => {
      if (!res) throw new PasswordRecoveryError()
    })
  }

  server.expose('authenticate', authenticate)
  server.expose('createSession', createSession)
  server.expose('destroySession', destroySession)
  server.expose('createToken', createToken)
  server.expose('generateTokenHash', generateTokenHash)
  server.expose('validateTokenHash', validateTokenHash)
  server.expose('generatePasswordHash', generatePasswordHash)

  next()
}

exports.register = function (server, options, next) {
  const schema = Joi.object({
    secret: Joi.string().required()
  })

  try {
    Joi.assert(options, schema, 'Invalid auth configuration')
  } catch (err) {
    return next(err)
  }

  server.dependency(internals.dependencies,
    (server, next) => internals.applyStrategy(server, options, next))

  next()
}

exports.register.attributes = {
  name: 'auth',
  dependencies: internals.dependencies
}
