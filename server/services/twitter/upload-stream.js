'use strict'

// Module dependencies.
const Transform = require('stream').Transform
const Promise = require('bluebird')

class TwitterUploadStream extends Transform {
  constructor (twitter, options, listenerFn) {
    if (typeof options === 'function') {
      listenerFn = options
      options = {}
    }
    options.highWaterMark = options.highWaterMark || 1 * 1024 * 1024
    super(options)
    this.twitter = twitter
    this.mediaSize = options.mediaSize
    this.mediaType = options.mediaType || 'application/octet-stream'
    this.listenerFn = listenerFn
    this.mediaId = null
    this.segmentIndex = 0
    this.on('pipe', (stream) => {
      stream._readableState.highWaterMark = options.highWaterMark
    })
  }

  _init () {
    return this.twitter.postAsync('media/upload', {
      command: 'INIT',
      media_type: this.mediaType,
      total_bytes: this.mediaSize
    }).then((data) => {
      this.mediaId = data.media_id_string
    })
  }

  _transform (data, enc, cb) {
    Promise.resolve()
      .then(() => this.mediaId || this._init())
      .tap(() => this.twitter.postAsync('media/upload', {
        command: 'APPEND',
        media_id: this.mediaId,
        media: data,
        segment_index: this.segmentIndex++
      }))
      .nodeify(cb)
  }

  _flush (cb) {
    this.twitter.postAsync('media/upload', {
      command: 'FINALIZE',
      media_id: this.mediaId
    }).nodeify((err) => {
      if (typeof this.listenerFn === 'function') {
        this.listenerFn(err, this.mediaId)
      }
      cb(err)
    })
  }
}

module.exports = TwitterUploadStream
