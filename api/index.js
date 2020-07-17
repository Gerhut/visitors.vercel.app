import { Client, query, errors } from 'faunadb'
import { makeBadge } from 'badge-maker'

/**
 * @param {import('http').IncomingMessage} request
 * @param {import('http').ServerResponse} response
 */
export default async function (request, response) {
  const { url } = request
  try {
    const client = new Client({ secret: process.env.FAUNADB_SECRET })
    const visitors = await client.query(
      query.Select(
        ['data', 'visitors'],
        query.Let(
          { match: query.Match(query.Index('visitors_by_url'), url) },
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
            query.Create(query.Collection('visitors'), { data: { url, visitors: 1 } })
          )
        )
      )
    )
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
