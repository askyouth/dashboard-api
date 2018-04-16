'use strict'

// Module dependencies.
const Composer = require('./server')

Composer((err, server) => {
  if (err) {
    throw err
  }

  server.start(() => {
    console.log('Dashboard started on port %s in %s mode', server.info.port, process.env.NODE_ENV)
  })
})
