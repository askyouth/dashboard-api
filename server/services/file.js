'use strict'

// Module dependencies.
const Joi = require('joi')
const path = require('path')
const fs = require('fs-blob-store')
const Promise = require('bluebird')

exports.register = function (server, options, next) {
  const schema = {
    directory: Joi.string().required()
  }

  try {
    Joi.assert(options, schema, 'Invalid upload configuration')
  } catch (err) {
    return next(err)
  }

  const dir = options.directory
  const blobs = fs(dir)

  function create (rs, options) {
    return new Promise((resolve, reject) => {
      let name = options.name
        ? `${generate(1)}-${options.name}}`
        : generate(4)
      let ws = blobs.createWriteStream(name)
      ws.on('error', reject)
      rs.pipe(ws)
      rs.on('end', (err) => {
        if (err) return reject(err)
        console.log(options.directory)
        console.log(name)
        resolve({
          name: name,
          filename: path.join(dir, name)
        })
      })
    })
  }

  function generate (num) {
    num || (num = 4)
    let str = ''
    for (let i = 0; i < num; i++) {
      str += Math.random().toString(16).slice(4)
    }
    return str
  }

  server.expose('create', create)

  next()
}

exports.register.attributes = {
  name: 'services/file'
}
