'use strict'

// Module dependencies.
const Config = require('config')

module.exports = {
  [process.env.NODE_ENV || 'development']: Config.get('database.knex')
}
