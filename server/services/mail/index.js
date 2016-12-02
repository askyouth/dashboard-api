'use strict'

// Module dependencies.
const Joi = require('joi')
const Path = require('path')
const Promise = require('bluebird')
const Handlebars = require('handlebars')
const Nodemailer = require('nodemailer')
const Markdown = require('nodemailer-markdown').markdown
const readFile = Promise.promisify(require('fs').readFile)

exports.register = function (server, options, next) {
  const schema = {
    transport: Joi.object({
      host: Joi.string().required(),
      port: Joi.number().integer().required(),
      secure: Joi.boolean(),
      auth: Joi.object({
        user: Joi.string().allow(''),
        pass: Joi.string().allow('')
      })
    }),
    fromAddress: Joi.string().email(),
    templateDir: Joi.string().required()
  }

  try {
    options = Joi.attempt(options, schema, 'Invalid mail options.')
  } catch (err) {
    return next(err)
  }

  const transport = Nodemailer.createTransport(options.transport)
  transport.use('compile', Markdown({ useEmbeddedImages: true }))

  Promise.promisifyAll(Object.getPrototypeOf(transport))

  const templateCache = {}

  function getTemplate (name) {
    return Promise.resolve(templateCache[name])
      .then((template) => {
        if (template) return template
        let filepath = Path.join(options.templateDir, `${name}.hbs.md`)
        let opts = { encoding: 'utf-8' }
        return readFile(filepath, opts).then((source) => {
          templateCache[name] = Handlebars.compile(source)
        })
      })
      .then(() => templateCache[name])
  }

  function renderTemplate (name, context) {
    return getTemplate(name).then((template) => template(context))
  }

  function sendMail (opts, template, context) {
    return renderTemplate(template, context)
      .then((content) => Object.assign({
        from: options.fromAddress,
        markdown: content
      }, opts))
      .then((opts) => transport.sendMailAsync(opts))
  }

  server.expose('sendEmail', sendMail)

  next()
}

exports.register.attributes = {
  name: 'services/mail'
}
