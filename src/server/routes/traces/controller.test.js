import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { mockSimulator } from '#/test-helpers/simulator.js'
import { scenarios } from '#/test-helpers/scenarios/index.js'

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

  function expectNewTabIndicators($) {
    const links = $('a[target="_blank"]')
    expect(links.length).toBeGreaterThan(0)
    links.each((_, link) => {
      expect($(link).find('[aria-hidden="true"]').text()).toBe('↗')
      expect($(link).find('.app-visually-hidden').text()).toBe(
        ' (opens in a new tab)'
      )
    })
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

  describe('CHED list', () => {
    const rowsOf = ($) =>
      $('tbody tr')
        .map((_, row) => $(row).text().replace(/\s+/g, ' ').trim())
        .get()

    test('Should offer to create or open a CHED', async () => {
      const { statusCode, $ } = await get('/traces')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('a[href="/traces/cheds/new"]').text()).toBe('Create a CHED')
      expect($('form[action="/traces/cheds"] input[name="id"]')).toHaveLength(1)
      expect($('.app-empty').text()).toContain('None yet')
    })

    test('Should list every CHED in the simulator, newest first, with current status', async () => {
      const chedP = structuredClone(liveHorses)
      chedP.exchangedDocument.includedNote.CHED_TYPE = 'P'
      const browser = await session()
      for (const model of [liveHorses, chedP]) {
        expect((await create(model, browser)).statusCode).toBe(201)
      }
      const chedA = simulator.cheds.get('CHEDA.XI.2026.0000001')
      chedA.certificate.status = 'VALIDATED'
      chedA.accessible = false

      // A fresh browser: the list is the simulator's, not this session's.
      const { $ } = await get('/traces')

      expect(rowsOf($)).toEqual([
        'CHEDP.XI.2026.0000002 CHED-P NEW 22 Apr 2026 12:00 Decision View certificate ↗ (opens in a new tab) Quantities ↗ (opens in a new tab) BTMS ↗ (opens in a new tab)',
        'CHEDA.XI.2026.0000001 CHED-A VALIDATED Not accessible 22 Apr 2026 12:00 Decision View certificate ↗ (opens in a new tab) Quantities ↗ (opens in a new tab) BTMS ↗ (opens in a new tab)'
      ])
      expectNewTabIndicators($)
    })

    test('Should page through older CHEDs', async () => {
      const browser = await session()
      for (let i = 0; i < 21; i++) {
        await create(liveHorses, browser)
      }

      const first = await get('/traces')
      const second = await get('/traces?page=2')

      expect(rowsOf(first.$)).toHaveLength(20)
      expect(first.$('a[rel="next"]').attr('href')).toBe('/traces?page=2')
      expect(first.$('a[rel="prev"]')).toHaveLength(0)
      expect(rowsOf(second.$)[0]).toContain('CHEDA.XI.2026.0000001')
      expect(second.$('a[rel="prev"]').attr('href')).toBe('/traces?page=1')
      expect(second.$('a[rel="next"]')).toHaveLength(0)
      expect(second.$('.app-pagination a[aria-current="page"]').text()).toBe(
        '2'
      )
      expect(
        second
          .$('.app-pagination__list a')
          .map((_, a) => second.$(a).text())
          .get()
      ).toEqual(['1', '2'])
    })

    test('Should refuse a page that is not a positive number', async () => {
      const { statusCode } = await get('/traces?page=0')

      expect(statusCode).toBe(statusCodes.badRequest)
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
    test('Should ask for a start: a blank CHED type or a scenario', async () => {
      const { statusCode, $ } = await get('/traces/cheds/new')
      const blanks = $('.app-start a')
        .map((_, a) => $(a).attr('href'))
        .get()

      expect(statusCode).toBe(statusCodes.ok)
      expect(blanks).toEqual([
        '?start=blank-A',
        '?start=blank-P',
        '?start=blank-PP',
        '?start=blank-D'
      ])
      expect(
        $('form[method="get"] select[name="start"] option').first().val()
      ).toBe('')
      expect($('form#create-ched')).toHaveLength(0)
    })

    test('Should present creating as Part I', async () => {
      const { $ } = await get('/traces/cheds/new')

      expect($('.app-breadcrumbs a').attr('href')).toBe('/traces')
      expect($('.app-heading__caption').text()).toContain('Part I')
      expect($('.app-heading__caption').text()).toContain('the operator')
    })

    test("Should offer the stub's scenarios, by name", async () => {
      simulator.scenarios.set('a-saved-one', {
        id: 'a-saved-one',
        name: 'A saved one',
        model: liveHorses
      })

      const { $ } = await get('/traces/cheds/new')

      expect(
        $('select[name="start"] option')
          .map((_, option) => $(option).text())
          .get()
      ).toEqual([
        'Choose a scenario',
        'A saved one',
        'CHED-A: cattle for slaughter, by head',
        'CHED-A: live horses',
        'CHED-P: milk',
        'CHED-PP: navel oranges'
      ])
    })

    test('Should fill the form from a scenario, arriving tomorrow, and go to the new CHED once created', async () => {
      const { statusCode, $ } = await get(
        '/traces/cheds/new?start=ched-a-live-horses'
      )
      const model = JSON.parse($('#ched-model').text())

      expect(statusCode).toBe(statusCodes.ok)
      expect(model.exchangedDocument).toEqual(liveHorses.exchangedDocument)
      expect(
        new Date(model.specifiedConsignment.availabilityDueDateTime).getTime()
      ).toBeGreaterThan(Date.now())
      expect($('.app-breadcrumbs').text()).toContain('CHED-A: live horses')
      expect($('form#create-ched').attr('data-action')).toBe(
        '/traces/api/cheds'
      )
      expect($('form#create-ched').attr('data-done')).toBe(
        '/traces/cheds/{id}?created=true'
      )
      expect($('form#create-ched').attr('data-scenario-action')).toBe(
        '/traces/api/scenarios'
      )
    })

    test('Should start a blank CHED of the type chosen', async () => {
      const { $ } = await get('/traces/cheds/new?start=blank-P')
      const model = JSON.parse($('#ched-model').text())

      expect(model.exchangedDocument.includedNote.CHED_TYPE).toBe('P')
      expect($('.app-breadcrumbs').text()).toContain('CHED-P')
    })

    test('Should say so when there is no such start', async () => {
      const { statusCode } = await get('/traces/cheds/new?start=nothing')

      expect(statusCode).toBe(statusCodes.notFound)
    })

    test('Should save a scenario to the stub', async () => {
      const response = await send(
        'PUT',
        '/traces/api/scenarios/horses-to-belfast',
        { name: 'Horses to Belfast', model: liveHorses },
        await session()
      )

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(simulator.scenarios.get('horses-to-belfast')).toEqual({
        id: 'horses-to-belfast',
        name: 'Horses to Belfast',
        model: liveHorses
      })
    })

    test('Should refuse a scenario ID that is not a slug', async () => {
      const response = await send(
        'PUT',
        '/traces/api/scenarios/Horses%20to%20Belfast',
        { name: 'Horses to Belfast', model: liveHorses },
        await session()
      )

      expect(response.statusCode).toBe(statusCodes.badRequest)
      expect(simulator.scenarios.has('Horses to Belfast')).toBe(false)
    })

    test('Should leave CHED type and status out of the form', async () => {
      const { $ } = await get('/traces/cheds/new?start=blank-A')

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

    test('Should validate the CHED with its checks', async () => {
      const { response, stored } = await decide({
        status: 'VALIDATED',
        DOCUMENTARY_CHECK: 'YES',
        DOCUMENTARY_CHECK_RESULT: 'SATISFACTORY',
        PHYSICAL_CHECK: 'NO'
      })

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(stored.status).toBe('VALIDATED')
      expect(stored.exchangedDocument.clearance.includedClause).toEqual({
        DECISION_CONCLUSION: 'ACCEPTABLE_FOR_FREE_CIRCULATION',
        DOCUMENTARY_CHECK: 'YES',
        DOCUMENTARY_CHECK_RESULT: 'SATISFACTORY',
        PHYSICAL_CHECK: 'NO'
      })
    })

    test('Should reject the CHED', async () => {
      const { response, stored } = await decide({
        status: 'REJECTED',
        IDENTITY_CHECK: 'YES',
        IDENTITY_CHECK_RESULT: 'NOT_SATISFACTORY'
      })

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(stored.status).toBe('REJECTED')
      expect(
        stored.exchangedDocument.clearance.includedClause.DECISION_CONCLUSION
      ).toBe('NOT_ACCEPTABLE')
    })

    test('Should save checks in progress without a conclusion', async () => {
      const { response, stored } = await decide({
        status: 'IN_PROGRESS',
        DOCUMENTARY_CHECK: 'YES'
      })

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(stored.status).toBe('IN_PROGRESS')
      expect(stored.exchangedDocument.clearance.includedClause).toEqual({
        DOCUMENTARY_CHECK: 'YES'
      })
    })

    test('Should refuse a status or code it does not know', async () => {
      for (const decision of [
        { status: 'maybe' },
        { status: 'VALIDATED', PHYSICAL_CHECK: 'SOMETIMES' }
      ]) {
        const { response, stored } = await decide(decision)

        expect(response.statusCode).toBe(statusCodes.badRequest)
        expect(stored.status).toBeUndefined()
      }
    })

    test('Should show the decision on the Part II page it reloads', async () => {
      const browser = await session()
      const { result } = await create(liveHorses, browser)
      await send(
        'POST',
        `/traces/api/cheds/${result.id}/decision`,
        { status: 'VALIDATED' },
        browser
      )

      const { $ } = await get(
        `/traces/cheds/${result.id}/decision?decided=VALIDATED`
      )

      expect($('.app-result').text()).toContain('Decision saved.')
      expect($('.app-result .app-tag').text()).toBe('VALIDATED')
      expect($('.app-title-row .app-tag').text()).toBe('VALIDATED')
      expect($('form[data-module="app-decision-form"]').attr('data-done')).toBe(
        `/traces/cheds/${result.id}/decision`
      )
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
      expect($('form#edit-ched').attr('data-action')).toBe(
        `/traces/api/cheds/${result.id}`
      )
      expect($('form#edit-ched').attr('data-method')).toBe('PUT')
    })

    test('Should show Part I and Part II as tabs, naming who completes each', async () => {
      const { result } = await create(liveHorses, await session())
      const tabs = ($) =>
        $('.app-sub-navigation a')
          .map((_, a) => $(a).text().replace(/\s+/g, ' '))
          .get()

      const partOne = (await get(`/traces/cheds/${result.id}`)).$
      const partTwo = (await get(`/traces/cheds/${result.id}/decision`)).$

      expect(tabs(partOne)).toEqual(['Part I Declaration', 'Part II Decision'])
      expect(partOne('[aria-current="page"]').last().text()).toContain('Part I')
      expect(partOne('.app-part-intro').text()).toContain('the operator')
      expect(partTwo('a[aria-current="page"]').text()).toContain('Part II')
      expect(partTwo('.app-part-intro').text()).toContain('border control post')
      expect(partTwo('.app-breadcrumbs a').attr('href')).toBe('/traces')
    })

    test('Should point to Part II after creating a CHED', async () => {
      const { result } = await create(liveHorses, await session())

      const { $ } = await get(`/traces/cheds/${result.id}?created=true`)

      expect($('.app-result').text()).toContain('Created.')
      expect($('.app-result a').attr('href')).toBe(
        `/traces/cheds/${result.id}/decision`
      )
    })

    test('Should open an undecided CHED as in progress, with one save button', async () => {
      const { result } = await create(liveHorses, await session())

      const { statusCode, $ } = await get(`/traces/cheds/${result.id}/decision`)

      expect(statusCode).toBe(statusCodes.ok)
      expect($('form[data-module="app-decision-form"]')).toHaveLength(1)
      expect($('main button').text()).toBe('Save')
      expect($('[name="status"]:checked').val()).toBe('IN_PROGRESS')
      expect($('[name="DOCUMENTARY_CHECK"]:checked')).toHaveLength(0)
    })

    test('Should open a decided CHED with its checks and status', async () => {
      const browser = await session()
      const { result } = await create(liveHorses, browser)
      await send(
        'POST',
        `/traces/api/cheds/${result.id}/decision`,
        {
          status: 'REJECTED',
          PHYSICAL_CHECK: 'YES',
          PHYSICAL_CHECK_RESULT: 'NOT_SATISFACTORY'
        },
        browser
      )

      const { $ } = await get(`/traces/cheds/${result.id}/decision`)

      expect($('[name="status"]:checked').val()).toBe('REJECTED')
      expect($('[name="PHYSICAL_CHECK_RESULT"]:checked').val()).toBe(
        'NOT_SATISFACTORY'
      )
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
