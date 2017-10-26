'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')
const Deputy = require('hapi-deputy')

exports.register = function (server, options, next) {
  const File = server.plugins['services/file']
  const Database = server.plugins['services/database']

  const Infographic = Database.model('Infographic')

  function loadInfographic (request, reply) {
    let infographicId = request.params.infographicId

    let infographic = Infographic.forge({ id: infographicId })
      .fetch({ require: true })
      .catch(Infographic.NotFoundError, () => Boom.notFound('Infographic not found'))

    reply(infographic)
  }

  server.route({
    method: 'GET',
    path: '/infographics',
    config: {
      description: 'Get list of infographics',
      tags: ['api', 'infographics'],
      validate: {
        query: {
          filter: Joi.object({
            date: Joi.string().regex(/^\d{4}-\d{2}$/)
          }).default({}),
          page: Joi.number().integer().default(1),
          pageSize: Joi.number().integer().default(20),
          sort: Joi.string().valid(['created_at']).default('created_at'),
          sortOrder: Joi.string().valid(['asc', 'desc']).default('asc')
        }
      }
    },
    handler (request, reply) {
      let filter = request.query.filter
      let page = request.query.page
      let pageSize = request.query.pageSize
      let sort = request.query.sort
      let sortOrder = request.query.sortOrder

      let infographics = Infographic
        .query((qb) => {
          if (filter.date) {
            qb.whereRaw('to_char(created_at, \'YYYY-MM\') = ?', filter.date)
          }
        })
        .orderBy(sort, sortOrder)
        .fetchPage({
          page: page,
          pageSize: pageSize
        })

      reply(infographics)
    }
  })

  server.route({
    method: 'GET',
    path: '/infographics/archive',
    config: {
      description: 'Get infographics archive by month',
      tags: ['api', 'infographics']
    },
    handler (request, reply) {
      let result = Database.knex('infographic')
        .column(Database.knex.raw('to_char(created_at, \'YYYY-MM\') as month'))
        .select()
        .groupBy('month')
        .orderBy('month', 'desc')

      reply(result)
    }
  })

  server.route({
    method: 'POST',
    path: '/infographics',
    config: {
      description: 'Create new infographic',
      tags: ['api', 'infographics'],
      payload: {
        output: 'stream',
        parse: true,
        maxBytes: 30 * 1024 * 1024,
        allow: 'multipart/form-data'
      }
    },
    handler (request, reply) {
      let file = request.payload.file
      let options = {
        name: file.hapi.filename,
        type: file.hapi.headers['content-type']
      }

      let infographic = File.create(file, options)
        .then((file) => Infographic.forge({
          url: file.url,
          name: file.key,
          file_size: file.size,
          file_type: file.type
        }).save())

      reply(infographic)
    }
  })

  server.route({
    method: 'GET',
    path: '/infographics/{infographicId}',
    config: {
      description: 'Get infographic',
      tags: ['api', 'infographics'],
      validate: {
        params: {
          infographicId: Joi.number().integer().required()
        }
      },
      pre: [{
        assign: 'infographic',
        method: loadInfographic
      }]
    },
    handler (request, reply) {
      let infographic = request.pre.infographic
      reply(infographic)
    }
  })

  server.route({
    method: 'GET',
    path: '/infographics/{infographicId}/download',
    config: {
      description: 'Download infographic',
      tags: ['api', 'infographics'],
      pre: [{
        assign: 'infographic',
        method: loadInfographic
      }]
    },
    handler (request, reply) {
      let infographic = request.pre.infographic
      let file = File.fetch(infographic.get('name'))
      let dispositionHeader = `attachment; filename=${infographic.get('name')}`

      reply(file)
        .header('Content-Disposition', dispositionHeader)
    }
  })

  server.route({
    method: 'DELETE',
    path: '/infographics/{infographicId}',
    config: {
      description: 'Delete infographic',
      tags: ['api', 'infographics'],
      validate: {
        params: {
          infographicId: Joi.number().integer().required()
        }
      },
      pre: [{
        assign: 'infographic',
        method: loadInfographic
      }]
    },
    handler (request, reply) {
      let infographic = request.pre.infographic

      let promise = File.remove(infographic.get('name'))
        .then(() => infographic.destroy())

      reply(promise).code(204)
    }
  })

  server.route({
    method: 'GET',
    path: '/{param*}',
    config: {
      description: 'Serve static content',
      tags: ['api'],
      auth: false
    },
    handler: {
      directory: {
        path: 'public'
      }
    }
  })

  next()
}

exports.register.attributes = {
  name: 'api/infographics',
  dependencies: [
    'services/file',
    'services/database'
  ]
}

module.exports = Deputy(exports)
