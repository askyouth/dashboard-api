'use strict'

class AuthenticationError extends Error {}
class PasswordRecoveryError extends Error {}

exports.AuthenticationError = AuthenticationError
exports.PasswordRecoveryError = PasswordRecoveryError
