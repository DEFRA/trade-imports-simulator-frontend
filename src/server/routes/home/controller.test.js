import { load } from 'cheerio'

import { config } from '#/config/config.js'
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
    expect($('main a[href="/cds"]').text()).toBe('CDS')
    expect($('main a[href="/fis"]').text()).toBe('FIS')
    expect($('main').text()).not.toContain('IPAFFS')
    expect($('main .app-tag').text()).toBe('EnabledEnabledEnabled')
  })
})

describe('#homeController with a simulator disabled', () => {
  let server

  beforeAll(async () => {
    config.set('tracesSimulator.enabled', false)
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    config.set('tracesSimulator.enabled', true)
    await server.stop({ timeout: 0 })
  })

  test('Should list it as disabled, without a link', async () => {
    const { payload } = await server.inject({ method: 'GET', url: '/' })
    const $ = load(payload)
    const tracesRow = $('main tr').filter((_i, row) =>
      $(row).text().includes('TRACES')
    )

    expect($('a[href="/traces"]')).toHaveLength(0)
    expect(tracesRow.find('.app-tag').text().trim()).toBe('Disabled')
    expect($('main a[href="/cds"]').text()).toBe('CDS')
  })

  test.each(['/traces', '/traces/cheds/new', '/poc/simulator/ched/1'])(
    'Should answer %s with an error page',
    async (url) => {
      const { payload, statusCode } = await server.inject({
        method: 'GET',
        url
      })

      expect(statusCode).toBe(statusCodes.notFound)
      expect(load(payload)('main').text()).toContain(
        'The TRACES simulator is not enabled in this environment'
      )
    }
  )

  test('Should refuse writes to it', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/traces/api/cheds',
      payload: {}
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
