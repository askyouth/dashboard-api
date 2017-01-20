'use strict'

// Module dependencies.
const Path = require('path')
const FsBlobStore = require('fs-blob-store')
const BaseFileStore = require('./base-file-store')
const StreamLength = require('./stream-length')

class LocalFileStore extends BaseFileStore {
  constructor (opts) {
    super(opts)
    this.store = new FsBlobStore(Path.resolve(opts.directory))
    this.baseUrl = opts.base_url
  }

  url (key) {
    return `${this.baseUrl}/${key}`
  }

  createWriteStream (opts, cb) {
    if (typeof opts === 'string') opts = { key: opts }
    if (!opts.key) opts.key = this.generateKey(opts)
    let proxy = new StreamLength()
    let ws = this.store.createWriteStream(opts, (err, info) => {
      if (err) return cb(err)
      cb(null, {
        key: info.key,
        size: proxy.length,
        url: this.url(info.key)
      })
    })
    proxy.pipe(ws)
    return proxy
  }

  createReadStream (key, opts) {
    return this.store.createReadStream(key, opts)
  }

  remove (opts, cb) {
    this.store.remove(opts, cb)
    return this
  }

  exists (opts, cb) {
    this.store.exists(opts, cb)
    return this
  }
}

module.exports = LocalFileStore
