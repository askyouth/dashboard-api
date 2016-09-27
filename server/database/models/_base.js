'use strict'

// Module dependencies.
const Joi = require('joi')
const Promise = require('bluebird')

const DEFAULT_TIMESTAMP_KEYS = ['created_at', 'updated_at']

module.exports = (bookshelf) => bookshelf.Model.extend({
  hasTimestamps: true,

  initialize (attrs, options) {
    this.schema = Object.assign(this.baseSchema(), this.schema)
    this.on('saving', (model, attrs, options) => {
      if (typeof options.validate === 'undefined' || options.validate) {
        return this.validate(model, attrs, options)
      }
    })
    bookshelf.Model.prototype.initialize.apply(this, arguments)
  },

  baseSchema () {
    let schema = {
      [this.idAttribute]: Joi.number().integer()
    }

    if (this.hasTimestamps) {
      let fields = Array.isArray(this.hasTimestamps)
        ? this.hasTimestamps
        : DEFAULT_TIMESTAMP_KEYS

      fields.forEach((field) => Object.assign(schema, {
        [field]: Joi.date().timestamp().allow(null)
      }))
    }

    return schema
  },

  validate () {
    return Promise.fromCallback((cb) => {
      Joi.validate(this.attributes, this.schema, { stripUnknown: true }, cb)
    })
  }
})
