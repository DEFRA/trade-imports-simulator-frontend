import { getChed } from './certificate-control.js'
import { ControlApiError } from './json-api.js'

describe('#certificateControl', () => {
  test('Should turn an unreachable simulator into a 502 naming it', async () => {
    fetch.mockReject(
      Object.assign(new TypeError('fetch failed'), {
        cause: { code: 'ECONNREFUSED' }
      })
    )

    const error = await getChed('CHEDA.XI.2026.0000001').catch((e) => e)

    expect(error).toBeInstanceOf(ControlApiError)
    expect(error.status).toBe(502)
    expect(error.message).toBe(
      'Could not reach the simulator at http://localhost:8085: ECONNREFUSED'
    )
  })

  test("Should carry the simulator's problem detail", async () => {
    fetch.mockResponse({
      status: 404,
      body: JSON.stringify({ detail: "No CHED 'X' exists in the simulator." }),
      headers: { 'content-type': 'application/problem+json' }
    })

    const error = await getChed('X').catch((e) => e)

    expect(error.status).toBe(404)
    expect(error.message).toBe("No CHED 'X' exists in the simulator.")
  })

  test('Should say so when something other than the stub answers', async () => {
    fetch.mockResponse({
      status: 404,
      body: '<html>Not found</html>',
      headers: { 'content-type': 'text/html' }
    })

    const error = await getChed('X').catch((e) => e)

    expect(error.status).toBe(502)
    expect(error.message).toContain("not the TRACES simulator's JSON")
    expect(error.message).toContain(
      'TRACES_SIMULATOR_URL (http://localhost:8085)'
    )
    expect(error.service).toBe('TRACES simulator')
  })
})
