'use strict'

// Module dependencies.
const Joi = require('joi')
const Boom = require('boom')

const internals = {}

internals.dependencies = ['database', 'services/file']

internals.applyRoutes = (server, next) => {
  const Database = server.plugins.database
  const Infographic = Database.model('Infographic')
  const File = server.plugins['services/file']

  function loadInfographic (request, reply) {
    let infographicId = request.params.infographicId

    let infographic = Infographic.forge({ id: infographicId })
      .fetch({ require: true })
      .catch(Infographic.NotFoundError, () => Boom.notFound())

    reply(infographic)
  }

  server.route({
    method: 'GET',
    path: '/infographics',
    config: {
      description: 'Get list of infographics',
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
      description: 'Get infographics archive by month'
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
      payload: {
        output: 'stream',
        parse: true,
        maxBytes: 30 * 1024 * 1024,
        allow: 'multipart/form-data'
      }
    },
    handler (request, reply) {
      let file = request.payload.file

      let infographic = File.create(file, { name: file.hapi.filename })
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
    handler: {
      directory: {
        path: 'public'
      }
    }
  })

  next()
}

exports.register = function (server, options, next) {
  server.dependency(internals.dependencies, internals.applyRoutes)
  next()
}

exports.register.attributes = {
  name: 'api/infographics'
}
