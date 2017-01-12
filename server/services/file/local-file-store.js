'use strict'

// Module dependencies.
const FsBlobStore = require('fs-blob-store')
const StreamLength = require('./stream-length')

class LocalFileStore {
  constructor (opts) {
    this.store = new FsBlobStore(opts.directory)
    this.baseUrl = opts.baseUrl
  }

  url (key) {
    return `${this.baseUrl}/${key}`
  }

  createWriteStream (opts, cb) {
    if (typeof opts === 'string') opts = { key: opts }
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
