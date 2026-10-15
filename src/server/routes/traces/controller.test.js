import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { mockSimulator } from '#/test-helpers/simulator.js'
import { scenarios } from './scenarios/index.js'

const liveHorses = scenarios[0].model

// Replaces cookies by name, as a browser does with Set-Cookie.
function mergeCookies(cookie, setCookies = []) {
  const jar = new Map(
    cookie.split('; ').map((pair) => [pair.split('=')[0], pair])
  )
  for (const setCookie of setCookies) {
    const pair = setCookie.split(';')[0]
    jar.set(pair.split('=')[0], pair)
  }
  return [...jar.values()].join('; ')
}

describe('TRACES routes', () => {
  let server
  let simulator

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    simulator = mockSimulator()
  })

  async function get(url, cookie) {
    const response = await server.inject({
      method: 'GET',
      url,
      headers: { cookie }
    })
    return { ...response, $: load(response.payload) }
  }

  // A browser session as the create page starts one: its cookies, and the crumb from the page.
  async function session() {
    const { $, headers } = await get('/traces/cheds/new')
    const cookie = headers['set-cookie'].map((c) => c.split(';')[0]).join('; ')
    return { cookie, crumb: $('meta[name="csrf-token"]').attr('content') }
  }

  async function send(method, url, payload, { cookie, crumb }) {
    const response = await server.inject({
      method,
      url,
      headers: { cookie, 'x-csrf-token': crumb },
      payload
    })
    return {
      ...response,
      cookie: mergeCookies(cookie, response.headers['set-cookie'])
    }
  }

  async function create(model, { cookie, crumb }) {
    const response = await server.inject({
      method: 'POST',
      url: '/traces/api/cheds',
      headers: { cookie, 'x-csrf-token': crumb },
      payload: model
    })
    return {
      ...response,
      cookie: mergeCookies(cookie, response.headers['set-cookie'])
    }
  }

  describe('Recent CHEDs', () => {
    test('Should offer to create or open a CHED', async () => {
      const { statusCode, $ } = await get('/traces')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('a[href="/traces/cheds/new"]').text()).toBe('Create a CHED')
      expect($('form[action="/traces/cheds"] input[name="id"]')).toHaveLength(1)
      expect($('.app-empty').text()).toContain('None yet')
    })

    test('Should list the CHEDs this session created, newest first, with current status', async () => {
      const chedP = structuredClone(liveHorses)
      chedP.exchangedDocument.includedNote.CHED_TYPE = 'P'
      let browser = await session()
      for (const model of [liveHorses, chedP]) {
        const created = await create(model, browser)
        expect(created.statusCode).toBe(201)
        browser = { ...browser, cookie: created.cookie }
      }
      simulator.cheds.get('CHEDA.XI.2026.0000001').certificate.status =
        'VALIDATED'

      const { $ } = await get('/traces', browser.cookie)
      const rows = $('tbody tr')
        .map((_, row) => $(row).text().replace(/\s+/g, ' ').trim())
        .get()

      expect(rows).toEqual([
        'CHEDP.XI.2026.0000002 CHED-P NEW Decision View certificate Quantities BTMS',
        'CHEDA.XI.2026.0000001 CHED-A VALIDATED Decision View certificate Quantities BTMS'
      ])
    })

    test('Should mark a CHED the simulator no longer has', async () => {
      const browser = await session()
      const { cookie } = await create(liveHorses, browser)
      simulator.cheds.clear()

      const { $ } = await get('/traces', cookie)

      expect($('tbody tr').text()).toContain('Not in the simulator')
    })

    test('Should open a CHED by reference', async () => {
      const { statusCode, headers } = await get(
        '/traces/cheds?id=CHEDA.XI.2026.0000001'
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/traces/cheds/CHEDA.XI.2026.0000001')
    })
  })

  describe('Create', () => {
    test('Should offer blank CHED types and scenarios above a disabled form', async () => {
      const { statusCode, $ } = await get('/traces/cheds/new')
      const models = JSON.parse($('#start-models').text())
      const blanks = $('#ched-start [data-start]')
        .map((_, button) => $(button).attr('data-start'))
        .get()
      const options = $('#ched-start select option')
        .map((_, option) => $(option).attr('value'))
        .get()

      expect(statusCode).toBe(statusCodes.ok)
      expect(blanks).toEqual(['blank-A', 'blank-P', 'blank-PP'])
      expect(options[0]).toBe('')
      expect(Object.keys(models)).toEqual([...blanks, ...options.slice(1)])
      expect($('#ched-start').closest('form')).toHaveLength(0)
      expect($('[data-ched-form-body]').attr('disabled')).toBeDefined()
      expect($('form#create-ched').attr('data-action')).toBe(
        '/traces/api/cheds'
      )
    })

    test('Should leave CHED type and status out of the form', async () => {
      const { $ } = await get('/traces/cheds/new')

      expect($('[name="chedType"], [name="status"]')).toHaveLength(0)
    })

    test('Should create the CHED in the simulator and return its reference', async () => {
      const { statusCode, result } = await create(liveHorses, await session())

      expect(statusCode).toBe(201)
      expect(result.id).toBe('CHEDA.XI.2026.0000001')
      expect(simulator.cheds.get(result.id).certificate).toEqual(liveHorses)
    })

    test("Should pass on the simulator's refusal", async () => {
      const model = structuredClone(liveHorses)
      model.specifiedConsignment.includedConsignmentItem.includedTradeLineItem[0].applicableClassification.CN =
        '9999'

      const { statusCode, result } = await create(model, await session())

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result.detail).toBe("Code '9999' is not in code list 'cn_code'.")
    })

    test('Should refuse a request without the CSRF token', async () => {
      const { cookie } = await session()

      const { statusCode } = await create(liveHorses, {
        cookie,
        crumb: undefined
      })

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(simulator.cheds.size).toBe(0)
    })
  })

  describe('Update', () => {
    test('Should replace the CHED with the edited model', async () => {
      const browser = await session()
      const { result } = await create(liveHorses, browser)
      const edited = structuredClone(liveHorses)
      edited.specifiedConsignment.exportCountry = 'XI'

      const response = await send(
        'PUT',
        `/traces/api/cheds/${result.id}`,
        edited,
        browser
      )

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(simulator.cheds.get(result.id).certificate).toEqual(edited)
    })

    test("Should pass on the simulator's refusal", async () => {
      const browser = await session()
      const { result } = await create(liveHorses, browser)
      const edited = structuredClone(liveHorses)
      edited.specifiedConsignment.includedConsignmentItem.includedTradeLineItem[0].applicableClassification.CN =
        '9999'

      const response = await send(
        'PUT',
        `/traces/api/cheds/${result.id}`,
        edited,
        browser
      )

      expect(response.statusCode).toBe(statusCodes.badRequest)
      expect(response.result.detail).toBe(
        "Code '9999' is not in code list 'cn_code'."
      )
      expect(simulator.cheds.get(result.id).certificate).toEqual(liveHorses)
    })

    test('Should be not found for a CHED the simulator lacks', async () => {
      const response = await send(
        'PUT',
        '/traces/api/cheds/CHEDA.XI.2026.0000099',
        liveHorses,
        await session()
      )

      expect(response.statusCode).toBe(statusCodes.notFound)
    })
  })

  describe('Decision', () => {
    async function decide(decision) {
      const browser = await session()
      const { result } = await create(liveHorses, browser)
      const response = await send(
        'POST',
        `/traces/api/cheds/${result.id}/decision`,
        decision,
        browser
      )
      return { response, stored: simulator.cheds.get(result.id).certificate }
    }

    test('Should accept the CHED', async () => {
      const { response, stored } = await decide({ decision: 'accept' })

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(stored.status).toBe('VALIDATED')
      expect(
        stored.exchangedDocument.clearance.includedClause.DECISION_CONCLUSION
      ).toBe('ACCEPTABLE_FOR_FREE_CIRCULATION')
    })

    test('Should reject the CHED with a refusal reason', async () => {
      const { response, stored } = await decide({
        decision: 'reject',
        refusalReason: 'MISSING_CERTIFICATE'
      })

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(stored.status).toBe('REJECTED')
      expect(stored.exchangedDocument.includedNote.REFUSAL_REASON).toBe(
        'MISSING_CERTIFICATE'
      )
    })

    test('Should refuse a decision it does not know', async () => {
      const { response, stored } = await decide({ decision: 'maybe' })

      expect(response.statusCode).toBe(statusCodes.badRequest)
      expect(stored.status).toBeUndefined()
    })

    test('Should show the decision on the CHED page it returns to', async () => {
      const browser = await session()
      const { result } = await create(liveHorses, browser)
      await send(
        'POST',
        `/traces/api/cheds/${result.id}/decision`,
        { decision: 'accept' },
        browser
      )

      const { $ } = await get(`/traces/cheds/${result.id}?decided=accept`)

      expect($('.app-result').text()).toContain('Accepted.')
      expect($('.app-result .app-tag').text()).toBe('VALIDATED')
    })
  })

  describe('A CHED', () => {
    test('Should give the edit form the CHED as its model', async () => {
      const { result } = await create(liveHorses, await session())

      const { statusCode, $ } = await get(`/traces/cheds/${result.id}`)

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1').text()).toBe(result.id)
      expect($('.app-title-row').text()).toContain('CHED-A')
      expect($('.app-title-row .app-tag').text()).toBe('NEW')
      expect($('a:contains("BTMS")').attr('href')).toBe(
        `http://localhost:3000/search-result?searchTerm=${result.id}`
      )
      expect(JSON.parse($('#ched-model').text())).toEqual(liveHorses)
      expect($('[data-ched-form-body]').attr('disabled')).toBeUndefined()
      expect($('form#edit-ched').attr('data-action')).toBe(
        `/traces/api/cheds/${result.id}`
      )
      expect($('form#edit-ched').attr('data-method')).toBe('PUT')
    })

    test('Should offer accept and reject on the decision page', async () => {
      const { result } = await create(liveHorses, await session())

      const { statusCode, $ } = await get(`/traces/cheds/${result.id}/decision`)

      expect(statusCode).toBe(statusCodes.ok)
      expect(
        $('main button')
          .map((_, b) => $(b).text())
          .get()
      ).toEqual(['Accept', 'Reject'])
      expect($('form[data-module="app-decision-form"]')).toHaveLength(2)
    })

    test('Should be not found when the simulator has no such CHED', async () => {
      const { statusCode } = await get('/traces/cheds/CHEDA.XI.2026.0000099')

      expect(statusCode).toBe(statusCodes.notFound)
    })

    test("Should explain a page the simulator couldn't serve", async () => {
      fetch.mockReject(
        Object.assign(new TypeError('fetch failed'), {
          cause: { code: 'ECONNREFUSED' }
        })
      )

      const { statusCode, $ } = await get('/traces/cheds/CHEDA.XI.2026.0000001')

      expect(statusCode).toBe(statusCodes.badGateway)
      expect($('main').text()).toContain(
        'The TRACES simulator: Could not reach the simulator at http://localhost:8085: ECONNREFUSED'
      )
    })

    test('Should reject a reference that is not a CHED', async () => {
      const { statusCode } = await get('/traces/cheds/not-a-ched')

      expect(statusCode).toBe(statusCodes.badRequest)
    })
  })
})
