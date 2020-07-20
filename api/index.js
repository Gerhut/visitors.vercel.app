import assert from 'assert'
import { Client, query, errors } from 'faunadb'
import { makeBadge } from 'badge-maker'

import hmac from '../hmac'

const {
  FAUNADB_SECRET,
  HMAC_KEY
} = process.env
const COLLECTION_NAME = 'visitors'
const INDEX_NAME = 'visitors_by_url'

assert(FAUNADB_SECRET != null, 'No FAUNADB_SECRET environment variable provided.')

/**
 * @param {import('http').IncomingMessage} request
 * @param {import('http').ServerResponse} response
 */
export default async function api (request, response) {
  const { url } = request
  const { pathname, searchParams } = new URL(url, 'http://localhost/')
  if (HMAC_KEY != null) {
    const token = searchParams.get('token')
    if (token == null) {
      response.writeHead(400).end('no token provided')
      return
    }
    if (token !== hmac(HMAC_KEY, pathname)) {
      response.writeHead(403).end('invalid token')
      return
    }
  }
  try {
    const client = new Client({ secret: process.env.FAUNADB_SECRET })
    let visitors
    try {
      visitors = await client.query(
        query.Select(
          ['data', 'visitors'],
          query.Let(
            { match: query.Match(query.Index(INDEX_NAME), pathname) },
            query.If(
              query.Exists(query.Var('match')),
              query.Let(
                { get: query.Get(query.Var('match')) },
                query.Update(query.Select('ref', query.Var('get')), {
                  data: {
                    visitors: query.Add(
                      query.Select(['data', 'visitors'], query.Var('get')),
                      1
                    )
                  }
                })
              ),
              query.Create(query.Collection(COLLECTION_NAME), {
                data: { url: pathname, visitors: 1 }
              })
            )
          )
        )
      )
    } catch (error) {
      if (
        error instanceof errors.FaunaHTTPError && (
          error.message === 'invalid ref' ||
          error.message === 'validation failed'
        )
      ) {
        const createdCollection = await client.query(
          query.If(
            query.Not(query.Exists(query.Collection(COLLECTION_NAME))),
            query.CreateCollection({
              name: COLLECTION_NAME
            }),
            null
          )
        )
        const createdIndex = await client.query(
          query.If(
            query.Not(query.Exists(query.Index(INDEX_NAME))),
            query.CreateIndex({
              name: INDEX_NAME,
              source: query.Collection(COLLECTION_NAME),
              terms: [
                { field: ['data', 'url'] }
              ],
              unique: true
            }),
            null
          )
        )
        if (createdCollection != null || createdIndex != null) {
          return api(request, response)
        }
      } else {
        throw error
      }
    }
    const body = makeBadge({
      label: 'visitors',
      message: String(visitors),
      color: (
        visitors < 10 ? 'red'
          : visitors < 50 ? 'orange'
            : visitors < 100 ? 'yellow'
              : visitors < 500 ? 'yellowgreen'
                : visitors < 1000 ? 'green'
                  : 'brightgreen'
      )
    })
    response.writeHead(200, {
      'Content-Type': 'image/svg+xml'
    }).end(body)
  } catch (error) {
    console.error(error)
    if (error instanceof errors.FaunaHTTPError) {
      response.writeHead(error.requestResult.statusCode).end(error.message)
    } else {
      response.writeHead(500).end(error.message)
    }
  }
}
