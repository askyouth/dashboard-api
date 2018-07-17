# ASK Dashboard

Dashboard app consists of two parts, [Node.js](https://nodejs.org/) [API](https://github.com/askyouth/dashboard-api) on top of [hapi](https://hapijs.com/) framework and [frontend](https://github.com/askyouth/dashboard-front) in [Angular.js](https://angularjs.org/).

<!-- markdown-toc start - Don't edit this section. Run M-x markdown-toc-refresh-toc -->
**Table of Contents**

- [ASK Dashboard](#ask-dashboard)
    - [Requirements](#requirements)
    - [Setup](#setup)
        - [Create Twitter Application](#create-twitter-application)
        - [Create Klout Application](#create-klout-application)
        - [Clone repository](#clone-repository)
        - [Setup environment](#setup-environment)
        - [Run migrations and seed database](#run-migrations-and-seed-database)
        - [Start](#start)
        - [Setup frontend app](#setup-frontend-app)
    - [License](#license)

<!-- markdown-toc end -->

## Requirements

* Node.js (8 or newer)
* Yarn
* PostgreSQL (9.4 or newer)
* [Twitter App credentials](https://apps.twitter.com/app/new)
* [Klout App credentials](https://developer.klout.com/apps)

## Setup

### Create Twitter Application

1. Go to http://apps.twitter.com/
2. Log in with your Broker Twitter account
3. Click on `Create New App`
4. Fill out required fields
5. Click on `Create your Twitter application`
6. Go to `Keys and Access Tokens` tab
7. Click on `Create my access token` button

### Create Klout Application

1. Go to https://klout.com/signup
2. Fill out required field
3. Click on `Register`

### Clone repository

```bash
git clone https://github.com/askyouth/dashboard-api.git 
yarn
cp .env.example .env
```

### Setup environment

Edit `.env` and fill out required variables. For the list of possible environment variables see `config/custom-environment-variables.json` file.

### Run migrations and seed database

```bash
yarn knex migrate:latest
yarn knex seed:run
```

### Start

```bash
yarn start
```

### Setup frontend app

Please refer to documentation for [askyouth/dashboard-front](https://github.com/askyouth/dashboard-front) for installation instructions.

## License

[MIT](https://github.com/askyouth/dashboard-api/blob/master/LICENSE)

---

![EU Erasmus+](priv/eu_flag_co_funded.jpg)

This project has been funded with support from the European Commission. This publication reflects the views only of the author, and the Commission cannot be held responsible for any use that may be made of the information contained therein.
