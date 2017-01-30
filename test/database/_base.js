'use strict'

// Module dependencies.
const Lab = require('lab')
const Code = require('code')
const Config = require('config')
const Joi = require('joi')
const Knex = require('knex')
const Bookshelf = require('bookshelf')
const baseModel = require('../../server/database/models/_base')

const lab = exports.lab = Lab.script()
let db
let bookshelf
let Model
let Book
let Page

lab.before(() => {
  db = Knex(Config.get('database.knex'))
  bookshelf = Bookshelf(db)
  Model = baseModel(bookshelf)

  Book = Model.extend({
    tableName: 'book',

    schema: {
      name: Joi.string(),
      author: Joi.string()
    },

    flatten: {
      pages: 'content'
    },

    pages () {
      return this.hasMany(Page)
    }
  })

  Page = Model.extend({
    tableName: 'page',

    schema: {
      content: Joi.string(),
      book_id: Joi.number().integer()
    },

    flatten: {
      book: ['name', 'author']
    },

    book () {
      return this.belongsTo(Book)
    },

    book2 () {
      return this.belongsTo(Book)
    }
  })

  return db.schema
    .createTable('book', (table) => {
      table.increments('id').primary()
      table.string('name')
      table.string('author')
    })
    .createTable('page', (table) => {
      table.increments('id').primary()
      table.string('content')
      table.integer('book_id').references('book.id')
    })
    .then(() => db('book').insert([
      { name: 'book1', author: 'author1' },
      { name: 'book2', author: 'author2' },
      { name: 'book3', author: 'author2' }
    ]).returning('id'))
    .then((bookIds) => db('page').insert([
      { content: 'abc', book_id: bookIds[0] },
      { content: 'efg', book_id: bookIds[0] },
      { content: 'abcd', book_id: bookIds[1] },
      { content: 'asdas', book_id: bookIds[2] }
    ]))
})

lab.after(() => {
  return db.schema
    .dropTable('page')
    .dropTable('book')
})

lab.experiment('Model serialize', () => {
  lab.test('it should flatten when relation is collection', () => {
    return Book.forge({ name: 'book1' })
      .fetch({ withRelated: ['pages'] })
      .then((book) => {
        book = book.toJSON()
        Code.expect(book).to.be.an.object()
        Code.expect(book.pages).to.be.an.array().and.equal(['abc', 'efg'])
      })
  })

  lab.test('it should flatten when relation is model', () => {
    return Page.forge({ content: 'abc' })
      .fetch({ withRelated: ['book'] })
      .then((page) => {
        page = page.toJSON()
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.an.object().and.equal({ name: 'book1', author: 'author1' })
      })
  })

  lab.test('it should flatten to value', () => {
    let PageOther = Page.extend({
      flatten: {
        book: 'name'
      }
    })

    return PageOther.forge({ content: 'abc' })
      .fetch({ withRelated: ['book'] })
      .then((page) => {
        page = page.toJSON()
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.equal('book1')
      })
  })

  lab.test('it should flatten only defined relations', () => {
    return Page.forge({ content: 'abc' })
      .fetch({ withRelated: ['book', 'book2'] })
      .then((page) => {
        page = page.toJSON()
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.an.object()
        Code.expect(page.book.id).to.be.a.undefined()
        Code.expect(page.book2).to.be.an.object()
        Code.expect(page.book2.id).to.be.a.number()
      })
  })

  lab.test('it should not flatten if flatten not defined for model', () => {
    let PageOther = Page.extend({
      flatten: null
    })

    return PageOther.forge({ content: 'abc' })
      .fetch({ withRelated: ['book'] })
      .then((page) => {
        page = page.toJSON()
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.an.object()
        Code.expect(page.book.id).to.be.a.number()
      })
  })

  lab.test('it should should flatten only defined relations', () => {
    let PageOther = Page.extend({
      flatten: null
    })

    return PageOther.forge({ content: 'abc' })
      .fetch({ withRelated: ['book'] })
      .then((page) => {
        page = page.toJSON()
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.an.object()
      })
  })

  lab.test('it should skip if relation not loaded', () => {
    return Page.forge({ content: 'abc' })
      .fetch()
      .then((page) => {
        page = page.toJSON()
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.undefined()
      })
  })

  lab.test('it should not flatten when options.flatten: false', () => {
    return Page.forge({ content: 'abc' })
      .fetch({ withRelated: ['book'] })
      .then((page) => {
        page = page.toJSON({ flatten: false })
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.an.object()
        Code.expect(page.book.id).to.be.a.number()
      })
  })

  lab.test('it should flatten when options.flatten: true', () => {
    return Page.forge({ content: 'abc' })
      .fetch({ withRelated: ['book'] })
      .then((page) => {
        page = page.toJSON({ flatten: true })
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.an.object()
        Code.expect(page.book).to.be.an.object().and.equal({ name: 'book1', author: 'author1' })
      })
  })

  lab.test('it should not flatten when options.shallow: true', () => {
    return Page.forge({ content: 'abc' })
      .fetch({ withRelated: ['book'] })
      .then((page) => {
        page = page.toJSON({ shallow: true })
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.an.undefined()
      })
  })

  lab.test('it should flatten when options.shallow: false', () => {
    return Page.forge({ content: 'abc' })
      .fetch({ withRelated: ['book'] })
      .then((page) => {
        page = page.toJSON({ shallow: false })
        Code.expect(page).to.be.an.object()
        Code.expect(page.book).to.be.an.object().and.equal({ name: 'book1', author: 'author1' })
      })
  })
})
