#!/usr/bin/env node
const assert = require('assert')
const { createHmac } = require('crypto')

/**
 * @param {string} key
 * @param {string} url
 * @returns {string}
 */
const hmac = module.exports = function hmac (key, url) {
  const hmac = createHmac('sha256', key)
  hmac.update(url, 'utf8')
  return hmac.digest('hex')
}

if (require.main === module) {
  require('dotenv/config')
  const { HMAC_KEY } = process.env
  assert(HMAC_KEY != null, 'Environment variable HMAC_KEY should be set to check the HMAC.')
  const url = process.argv[2]
  assert(url != null, 'Please provide a url as the command parameter.')
  assert(url.charAt(0) === '/', 'URL should be started with slash("/")')

  process.stdout.write(hmac(HMAC_KEY, url))
}
