'use strict'

// Module dependencies.
const S3 = require('aws-sdk/clients/s3')
const S3BlobStore = require('s3-blob-store')
const StreamLength = require('./stream-length')

class S3BlobStoreFix extends S3BlobStore {
  uploadParams (opts) {
    let params = super.uploadParams(opts)
    if (opts.ACL) (params.ACL = opts.ACL)
    return params
  }
}

class S3FileStore {
  constructor (opts) {
    this.bucket = opts.bucket
    this.client = opts.client || new S3({
      accessKeyId: opts.access_key,
      secretAccessKey: opts.secret_key
    })
    this.store = new S3BlobStoreFix({
      client: this.client,
      bucket: opts.bucket
    })
  }

  url (key) {
    return `https://${this.bucket}.s3.amazonaws.com/${key}`
  }

  createWriteStream (opts, s3opts, cb) {
    if (typeof s3opts === 'function') {
      cb = s3opts
      s3opts = {}
    }
    if (typeof opts === 'string') opts = { key: opts }
    opts = Object.assign({ ACL: 'public-read' }, opts)
    let proxy = new StreamLength()
    let ws = this.store.createWriteStream(opts, s3opts, (err, info) => {
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

  createReadStream (opts) {
    return this.store.createReadStream(opts)
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

module.exports = S3FileStore
