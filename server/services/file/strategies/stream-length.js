'use strict'

// Module dependencies.
const Transform = require('stream').Transform

class StreamLength extends Transform {
  constructor (options) {
    super(options)
    this._length = 0
  }

  _transform (data, enc, cb) {
    this._length += data.length
    this.push(data)
    cb()
  }

  get length () {
    return this._length
  }
}

module.exports = StreamLength
