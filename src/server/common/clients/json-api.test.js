import { ControlApiError, jsonApi } from './json-api.js'

const send = jsonApi({
  service: 'CDS simulator',
  setting: 'CDS_SIMULATOR_URL',
  baseUrl: () => 'http://localhost:5003',
  headers: () => ({ authorization: 'Basic abc' })
})

const answer = (status, body) =>
  fetch.mockResponse({
    status,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  })

describe('#jsonApi', () => {
  test('Should send its headers with every request', async () => {
    answer(200, [])

    await send('/scenarios')

    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      accept: 'application/json',
      authorization: 'Basic abc'
    })
  })

  test("Should turn ASP.NET's plain string refusal into a problem detail", async () => {
    answer(409, 'Entry X with version 2 already exists')

    const error = await send('/x').catch((e) => e)

    expect(error).toBeInstanceOf(ControlApiError)
    expect(error.status).toBe(409)
    expect(error.message).toBe('Entry X with version 2 already exists')
    expect(error.service).toBe('CDS simulator')
  })

  test('Should keep the request that failed', async () => {
    fetch.mockResponse({ status: 405, body: '' })

    const error = await send('/x/1', {
      method: 'POST',
      body: '{"a":1}'
    }).catch((e) => e)

    expect(error.message).toBe('The simulator returned 405')
    expect(error.request).toEqual({
      method: 'POST',
      url: 'http://localhost:5003/x/1',
      body: '{"a":1}'
    })
  })

  test('Should name a GET when no method is given', async () => {
    fetch.mockResponse({ status: 405, body: '' })

    const error = await send('/x/1').catch((e) => e)

    expect(error.request).toEqual({
      method: 'GET',
      url: 'http://localhost:5003/x/1',
      body: undefined
    })
  })

  test('Should say which fields a validation problem is about', async () => {
    answer(400, {
      title: 'One or more validation errors occurred.',
      errors: { Mrn: ['must be set'], From: ['must be UTC'] }
    })

    const error = await send('/x').catch((e) => e)

    expect(error.message).toBe('must be set must be UTC')
  })
})
