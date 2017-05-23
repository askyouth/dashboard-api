'use strict'

// Module dependencies.
const Joi = require('joi')
const Promise = require('bluebird')

const DEFAULT_TIMESTAMP_KEYS = ['created_at', 'updated_at']

module.exports = (bookshelf) => bookshelf.Model.extend({
  hasTimestamps: true,

  constructor () {
    this.schema = Object.assign(this.baseSchema(), this.schema)
    bookshelf.Model.apply(this, arguments)
  },

  /**
   * Initializes the model.
   *
   * Sets models schema and validation hooks.
   */

  initialize (attrs, options) {
    this.on('saving', (model, attrs, options) => {
      if (typeof options.validate === 'undefined' || options.validate) {
        return this.validate(model, attrs, options)
      }
    })
    bookshelf.Model.prototype.initialize.apply(this, arguments)
  },

  /**
   * Generates base schema.
   *
   * Base schema includes id attribute
   * and timestamp fields.
   */

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

  /**
   * Validation hook.
   */

  validate () {
    return Promise.fromCallback((cb) => {
      Joi.validate(this.attributes, this.schema, { stripUnknown: true }, cb)
    })
  },

  /**
   * Parses response from database.
   *
   * Ensures that only fields defined in schema
   * are assigned to attributes. It prevents errors
   * when saving model previously fetched by
   * overriding underlying querybuilder.
   */

  parse (attrs) {
    let result = Joi.validate(attrs, this.schema, { stripUnknown: true })
    if (result.error) return attrs
    return result.value
  },

  /**
   * Serializes model to plain object.
   *
   * @param {Object} options Serializer options.
   * @param {Boolean} [options.shallow=false]
   *   Do not serialize loaded relations. Defaults to `false`.
   * @param {Boolean} [options.flatten=true]
   *   Flatten loaded relations. Defaults to `true`.
   *
   * @return {Object} Serialized object.
   */

  serialize (options) {
    options || (options = {})

    let object = bookshelf.Model.prototype.serialize.apply(this, arguments)

    if (!this.flatten ||
      (typeof options.shallow !== 'undefined' && options.shallow) ||
      (typeof options.flatten !== 'undefined' && !options.flatten)) {
      return object
    }

    Object.keys(this.flatten).forEach((name) => {
      let value = this.flatten[name]
      let relation = this.relations[name]
      if (relation) {
        if (typeof relation.length !== 'undefined') {
          object[name] = relation.pluck(value)
        } else {
          object[name] = relation[Array.isArray(value) ? 'pick' : 'get'](value)
        }
      }
    })

    return object
  }
})
