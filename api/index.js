import assert from 'assert'
import { makeBadge } from 'badge-maker'
import Redis from 'ioredis'

import hmac from '../hmac'

const { REDIS_URL, HMAC_KEY } = process.env

assert(REDIS_URL != null, 'No REDIS_URL environment variable provided.')

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
      response.writeHead(400).end('No token provided')
      return
    }
    if (token !== hmac(HMAC_KEY, pathname)) {
      response.writeHead(403).end('Invalid token')
      return
    }
  }
  try {
    const redis = new Redis(REDIS_URL)
    const visitors = await redis.incr(`url:${pathname}`)
    const body = makeBadge({
      label: 'visitors',
      message: String(visitors),
      color:
        visitors < 10
          ? 'red'
          : visitors < 50
            ? 'orange'
            : visitors < 100
              ? 'yellow'
              : visitors < 500
                ? 'yellowgreen'
                : visitors < 1000
                  ? 'green'
                  : 'brightgreen'
    })
    response
      .writeHead(200, {
        'Content-Type': 'image/svg+xml'
      })
      .end(body)
  } catch (error) {
    console.error(error)
    response.writeHead(500).end(error.message)
  }
}
