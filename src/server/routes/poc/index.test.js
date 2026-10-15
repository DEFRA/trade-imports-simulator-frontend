import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#poc proxy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  const page =
    '<html><style>body{}</style><a href="CHEDA.XI.2026.0000001/quantities">Q</a></html>'

  test("Should serve the POC's page for a simulator CHED, as the POC sent it", async () => {
    fetch.mockResponse({
      body: page,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })

    const response = await server.inject({
      method: 'GET',
      url: '/poc/simulator/ched/CHEDA.XI.2026.0000001?format=html',
      headers: { accept: 'text/html' }
    })

    expect(response.statusCode).toBe(statusCodes.ok)
    expect(response.payload).toBe(page)
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8')
    // The POC's inline styles and scripts would break under this app's policy.
    expect(response.headers['content-security-policy']).toBeUndefined()

    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(
      'http://localhost:8090/simulator/ched/CHEDA.XI.2026.0000001?format=html'
    )
    expect(options.headers.accept).toBe('text/html')
  })

  test('Should ask for HTML when a browser loads a page, despite the XML in its Accept', async () => {
    fetch.mockResponse({ body: page, headers: { 'content-type': 'text/html' } })

    await server.inject({
      method: 'GET',
      url: '/poc/simulator/ched/find',
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })

    expect(fetch.mock.calls[0][1].headers.accept).toBe('text/html')
  })

  test('Should pass a relative redirect through, so it stays under /poc', async () => {
    fetch.mockResponse({
      status: 302,
      headers: { location: '?from=2026-10-15T00%3A00%3A00Z' }
    })

    const response = await server.inject({
      method: 'GET',
      url: '/poc/simulator/ched/find'
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('?from=2026-10-15T00%3A00%3A00Z')
  })

  test('Should refuse anything but the simulator target', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/poc/ched/CHEDA.XI.2026.0000001'
    })

    expect(response.statusCode).toBe(statusCodes.notFound)
    expect(fetch).not.toHaveBeenCalled()
  })

  test("Should forward the quantity console's writes, with their body", async () => {
    fetch.mockResponse({
      status: 200,
      body: '{}',
      headers: { 'content-type': 'application/json' }
    })

    const response = await server.inject({
      method: 'PUT',
      url: '/poc/simulator/ched/CHEDA.XI.2026.0000001/declarations/26GB0000000000001/reservation',
      headers: {
        'content-type': 'application/json',
        'x-customs-office': 'GBBEL001'
      },
      payload: '{"items":[]}'
    })

    expect(response.statusCode).toBe(statusCodes.ok)
    const [, options] = fetch.mock.calls[0]
    expect(options.method).toBe('PUT')
    expect(options.body.toString()).toBe('{"items":[]}')
    expect(options.headers['x-customs-office']).toBe('GBBEL001')
  })

  test('Should refuse writes anywhere else', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/poc/simulator/ched/',
      payload: '<SPSCertificate/>'
    })

    expect(response.statusCode).toBe(statusCodes.notFound)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should refuse a cross-site write', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/poc/simulator/ched/CHEDA.XI.2026.0000001/declarations/26GB0000000000001/clearance',
      headers: { 'sec-fetch-site': 'cross-site' }
    })

    expect(response.statusCode).toBe(statusCodes.forbidden)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should say when the POC is unreachable', async () => {
    fetch.mockReject(
      Object.assign(new TypeError('fetch failed'), {
        cause: { code: 'ECONNREFUSED' }
      })
    )

    const response = await server.inject({
      method: 'GET',
      url: '/poc/simulator/ched/find'
    })

    expect(response.statusCode).toBe(statusCodes.badGateway)
    expect(response.payload).toBe(
      'Could not reach the POC at http://localhost:8090: ECONNREFUSED'
    )
  })
})
