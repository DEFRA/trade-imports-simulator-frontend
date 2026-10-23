import { mockSimulator } from '#/test-helpers/simulator.js'

describe('#getReferenceData', () => {
  let getReferenceData

  beforeEach(async () => {
    vi.resetModules()
    fetch.resetMocks()
    ;({ getReferenceData } = await import('./reference-data.js'))
  })

  test('Should read each list from the stub', async () => {
    mockSimulator()

    const lists = await getReferenceData()

    expect(lists.cnCodes).toEqual([
      { code: '0101', name: 'Live horses, asses, mules and hinnies' }
    ])
    expect(lists.borderControlPosts[0].code).toBe('GBBEL')
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8085/control/lookups/cn_code',
      expect.anything()
    )
  })

  test('Should read the lists once', async () => {
    mockSimulator()

    await getReferenceData()
    const calls = fetch.mock.calls.length
    await getReferenceData()

    expect(fetch.mock.calls).toHaveLength(calls)
  })

  test("Should pass on the stub's problem, and try again next time", async () => {
    fetch.mockResponse({
      status: 404,
      body: JSON.stringify({ detail: "No code list 'cn_code' is seeded." }),
      headers: { 'content-type': 'application/problem+json' }
    })

    await expect(getReferenceData()).rejects.toThrow(
      "No code list 'cn_code' is seeded."
    )

    mockSimulator()
    await expect(getReferenceData()).resolves.toHaveProperty('cnCodes')
  })
})
