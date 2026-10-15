import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#homeController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should list the simulators', async () => {
    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })
    const $ = load(payload)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('title').text().trim()).toBe(
      'Simulators | Trade imports simulator'
    )
    expect($('main a[href="/traces"]').text()).toBe('TRACES')
  })
})
