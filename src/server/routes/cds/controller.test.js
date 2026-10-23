import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { mockCdsSimulator } from '#/test-helpers/cds-simulator.js'

const request = {
  serviceHeader: { sourceSystem: 'CDS', destinationSystem: 'ALVS' },
  header: {
    declarationUCR: '1GB116445386000-KDA35932Y1BHX',
    declarationType: 'S'
  },
  items: [{ itemNumber: 1, taricCommodityCode: '0101210000', documents: [] }]
}

describe('CDS routes', () => {
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
    simulator = mockCdsSimulator()
  })

  async function get(url) {
    const response = await server.inject({ method: 'GET', url })
    return { ...response, $: load(response.payload) }
  }

  // A browser session as the create page starts one: its cookies, and the crumb from the page.
  async function session() {
    const { $, headers } = await get('/cds/declarations/new?start=blank')
    const cookie = headers['set-cookie'].map((c) => c.split(';')[0]).join('; ')
    return { cookie, crumb: $('meta[name="csrf-token"]').attr('content') }
  }

  async function send(method, url, payload) {
    const { cookie, crumb } = await session()
    return server.inject({
      method,
      url,
      headers: { cookie, 'x-csrf-token': crumb },
      payload
    })
  }

  // Sends n declarations through the app, as the create page would, and returns their MRNs.
  async function createDeclarations(n) {
    const mrns = []
    for (let i = 0; i < n; i++) {
      const response = await send(
        'POST',
        '/cds/api/clearance-requests',
        request
      )
      mrns.push(JSON.parse(response.payload).mrn)
    }
    return mrns
  }

  test('Should list declarations, most recently sent first', async () => {
    const [first, second] = await createDeclarations(2)

    const { statusCode, $ } = await get('/cds')
    const mrns = $('tbody tr td:first-child a')
      .map((_, a) => $(a).text())
      .get()

    expect(statusCode).toBe(statusCodes.ok)
    expect(mrns).toEqual([second, first])
    expect($(`a[href="/cds/declarations/${first}/finalise"]`)).toHaveLength(1)
    expect($('a[href="/cds/declarations/new"]').text()).toContain(
      'Create a declaration'
    )
    expect(
      $('form[action="/cds/declarations/open"] input[name="mrn"]')
    ).toHaveLength(1)
  })

  test('Should page the list, 20 at a time', async () => {
    await createDeclarations(21)

    const first = await get('/cds')
    const second = await get('/cds?page=2')

    expect(first.$('tbody tr')).toHaveLength(20)
    expect(first.$('a[href="/cds?page=2"]').length).toBeGreaterThan(0)
    expect(second.$('tbody tr')).toHaveLength(1)
    expect(second.$('.app-pagination a[aria-current="page"]').text()).toBe('2')
  })

  test('Should say when there are no declarations yet', async () => {
    const { $ } = await get('/cds')

    expect($('.app-empty').text()).toContain('None yet')
  })

  test('Should ask for a start: blank, or one of the saved scenarios', async () => {
    simulator.scenarios.set('horses', {
      id: 'horses',
      name: 'Horses',
      model: request
    })

    const { statusCode, $ } = await get('/cds/declarations/new')

    expect(statusCode).toBe(statusCodes.ok)
    expect($('a[href="?start=blank"]').text()).toContain('Blank')
    expect(
      $('form[method="get"] select[name="start"] option[value="horses"]').text()
    ).toBe('Horses')
    expect($('[data-module="app-cds-declaration-form"]')).toHaveLength(0)
  })

  test('Should fill the form from the blank start, arriving tomorrow', async () => {
    const { statusCode, $ } = await get('/cds/declarations/new?start=blank')
    const model = JSON.parse($('#declaration-model').text())

    expect(statusCode).toBe(statusCodes.ok)
    expect(model.serviceHeader).toEqual({
      sourceSystem: 'CDS',
      destinationSystem: 'ALVS'
    })
    expect(model.header).toMatchObject({
      declarationType: 'S',
      declarantId: 'GB999000000001',
      dispatchCountryCode: 'FR',
      goodsLocationCode: 'LGPLGPLGP'
    })
    expect(model.header.arrivalDateTime).toBeGreaterThan(Date.now())
    expect($('.app-breadcrumbs').text()).toContain('Blank')
    expect(
      $('[data-module="app-cds-declaration-form"]').attr('data-scenario-action')
    ).toBe('/cds/api/scenarios')
  })

  test('Should fill the form from a saved scenario, keeping its arrival time', async () => {
    simulator.scenarios.set('horses', {
      id: 'horses',
      name: 'Horses',
      model: { ...request, header: { ...request.header, arrivalDateTime: 1 } }
    })

    const { $ } = await get('/cds/declarations/new?start=horses')
    const model = JSON.parse($('#declaration-model').text())

    expect(model.header.declarationUCR).toBe(request.header.declarationUCR)
    expect(model.header.arrivalDateTime).toBe(1)
  })

  test('Should say so when there is no such start', async () => {
    const { statusCode } = await get('/cds/declarations/new?start=nothing')

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('Should offer countries for dispatch and for each item, starting blank', async () => {
    const { $ } = await get('/cds/declarations/new?start=blank')
    const dispatch = $('select[name="dispatchCountryCode"] option')
    const origin = load($('template[data-cds-item]').html())(
      'select[name="itemOriginCountryCode"] option'
    )

    expect(dispatch.first().attr('value')).toBe('')
    expect(
      $('select[name="dispatchCountryCode"] option[value="CN"]').text()
    ).toBe('CN – China')
    expect(origin).toHaveLength(dispatch.length)
  })

  test('Should suggest a thousand made-up declarants', async () => {
    const { $ } = await get('/cds/declarations/new?start=blank')
    const list = $(`#${$('input[name="declarant"]').attr('list')} option`)

    expect(list).toHaveLength(1000)
    expect(list.first().attr('value')).toBe('GB999000000001')
    expect(list.last().attr('value')).toBe('GB999000001000')
  })

  test('Should offer the document codes BTMS acts on', async () => {
    const { $ } = await get('/cds/declarations/new?start=blank')
    const codes = $('template[data-cds-document]')
      .html()
      .match(/value="[^"]+"/g)

    expect(codes).toContain('value="N853"')
    expect(codes).toContain('value="C085"')
  })

  test('Should offer the declaration types, goods locations and procedure codes CDS sent', async () => {
    const { $ } = await get('/cds/declarations/new?start=blank')
    const item = load($('template[data-cds-item]').html())

    expect(
      $('select[name="declarationType"] option')
        .map((_, option) => $(option).attr('value'))
        .get()
    ).toEqual(['S', 'F'])
    expect(
      $('select[name="goodsLocationCode"] option[value="DVRDOVDVRGVM"]').text()
    ).toBe('DVRDOVDVRGVM – Dover GVMS Port')
    expect(
      item('select[name="customsProcedureCode"] option[value="40001CG"]').text()
    ).toBe(
      '40001CG – Release to free circulation; Controlled goods using simplified procedures'
    )
  })

  test('Should offer check codes, and the combinations real items carried', async () => {
    const { $ } = await get('/cds/declarations/new?start=blank')
    const checks = load($('template[data-cds-check]').html())
    const item = load($('template[data-cds-item]').html())
    const lookups = JSON.parse($('#create-declaration-lookups').text())

    expect(checks('select[name="checkCode"] option[value="H222"]').text()).toBe(
      'H222 – PHA'
    )
    expect(item('select[name="combination"] option[value="0"]').text()).toBe(
      'H222 → N853'
    )
    expect(lookups.departments.H218).toBe('HMI')
    expect(lookups.combinations[0]).toMatchObject({
      checks: ['H222'],
      documents: ['N853']
    })
  })

  test('Should relay a new clearance request and the MRN the simulator issued', async () => {
    const response = await send('POST', '/cds/api/clearance-requests', request)

    expect(response.statusCode).toBe(201)
    expect(JSON.parse(response.payload)).toMatchObject({
      mrn: '26GBFAKE0000000001',
      entryVersionNumber: 1
    })
    expect(simulator.declarations.has('26GBFAKE0000000001')).toBe(true)
  })

  test("Should pass on the simulator's refusal as a problem with its message", async () => {
    const response = await send('POST', '/cds/api/clearance-requests', {
      ...request,
      serviceHeader: { ...request.serviceHeader, correlationId: '123' }
    })

    expect(response.statusCode).toBe(400)
    expect(response.headers['content-type']).toContain(
      'application/problem+json'
    )
    expect(JSON.parse(response.payload).detail).toBe(
      'ServiceHeader.CorrelationId must not be set'
    )
  })

  test('Should start an amendment from the latest version', async () => {
    await send('POST', '/cds/api/clearance-requests', request)
    await send('POST', '/cds/api/clearance-requests', {
      ...request,
      header: {
        ...request.header,
        entryReference: '26GBFAKE0000000001',
        entryVersionNumber: 2,
        previousVersionNumber: 1,
        declarationUCR: 'SECOND'
      }
    })

    const { statusCode, $ } = await get(
      '/cds/declarations/26gbfake0000000001/amend'
    )
    const form = $('[data-module="app-cds-declaration-form"]')

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text()).toContain('Amend 26GBFAKE0000000001')
    expect(form.attr('data-mrn')).toBe('26GBFAKE0000000001')
    expect(form.attr('data-version')).toBe('2')
    expect(
      JSON.parse($('#declaration-model').text()).header.declarationUCR
    ).toBe('SECOND')
    expect(form.attr('data-scenario-action')).toBeUndefined()
  })

  test('Should refuse a second amendment to the same version', async () => {
    await send('POST', '/cds/api/clearance-requests', request)
    const amendment = {
      ...request,
      header: {
        ...request.header,
        entryReference: '26GBFAKE0000000001',
        entryVersionNumber: 2,
        previousVersionNumber: 1
      }
    }
    await send('POST', '/cds/api/clearance-requests', amendment)

    const response = await send(
      'POST',
      '/cds/api/clearance-requests',
      amendment
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.payload).detail).toBe(
      'Entry 26GBFAKE0000000001 with version 2 already exists'
    )
  })

  test('Should say so when there is no declaration to amend', async () => {
    const { statusCode } = await get(
      '/cds/declarations/26GBNOTHERE0000000/amend'
    )

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('Should move the MRN from the open form into the path', async () => {
    const { statusCode, headers } = await get(
      '/cds/declarations/open?mrn=+26gbfake0000000001+'
    )

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/cds/declarations/26GBFAKE0000000001')
  })

  test('Should refuse something that is not an MRN', async () => {
    const { statusCode } = await get(
      '/cds/declarations/open?mrn=CHEDA.XI.2026.0000001'
    )

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should show the latest version on the Request tab, earlier ones folded under it', async () => {
    const [mrn] = await createDeclarations(1)
    await send('POST', '/cds/api/clearance-requests', {
      ...request,
      header: {
        ...request.header,
        entryReference: mrn,
        entryVersionNumber: 2,
        previousVersionNumber: 1,
        dispatchCountryCode: 'CN'
      }
    })

    const { statusCode, $ } = await get(`/cds/declarations/${mrn}`)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text()).toBe(mrn)
    expect($('.app-sub-navigation [aria-current="page"]').text()).toContain(
      'Request'
    )
    expect($('a[href$="/amend"]').text()).toContain('send version 3')
    expect($('.app-summary-list').first().text()).toContain('CN – China')
    expect($('.app-summary-list').text()).toContain(
      '0101210000 Pure-bred breeding animals'
    )
    expect($('details.app-cds-version summary').text()).toContain('Version 1')
  })

  test('Should show what BTMS sent back on the Decisions tab, newest first', async () => {
    const [mrn] = await createDeclarations(1)
    const replies = simulator.declarations.get(mrn)
    replies.decisions.push({
      timestamp: '2026-10-22T10:00:00Z',
      entryVersionNumber: 1,
      decisionNumber: 1,
      items: [
        {
          itemNumber: 1,
          checks: [
            {
              checkCode: 'H222',
              decisionCode: 'X00',
              decisionReason: 'No CHED'
            }
          ]
        }
      ]
    })
    replies.errors.push({
      timestamp: '2026-10-22T10:05:00Z',
      entryVersionNumber: 1,
      errors: [{ errorCode: 'ERR022', errorMessage: 'Net Mass' }]
    })

    const { statusCode, $ } = await get(`/cds/declarations/${mrn}/decisions`)
    const shown = $('.app-cds-reply')
    const decision = shown.last()

    expect(statusCode).toBe(statusCodes.ok)
    expect(shown.first().hasClass('app-cds-reply--error')).toBe(true)
    expect(shown.first().text()).toContain('ERR022')
    expect(decision.find('.app-cds-item__title').text()).toBe('Item 1')
    expect(decision.find('.app-summary-list').text()).toContain(
      '0101210000 Pure-bred breeding animals'
    )
    expect(decision.find('.app-tag').text().trim()).toBe('X00 No match')
    expect(decision.text()).toContain('H222 – PHA')
    expect(decision.text()).toContain('No CHED')
  })

  test('Should group replies by version, the latest open and earlier ones folded', async () => {
    const [mrn] = await createDeclarations(1)
    await send('POST', '/cds/api/clearance-requests', {
      ...request,
      header: {
        ...request.header,
        entryReference: mrn,
        entryVersionNumber: 2,
        previousVersionNumber: 1
      }
    })
    const decision = (version, code) => ({
      timestamp: `2026-10-22T10:0${version}:00Z`,
      entryVersionNumber: version,
      decisionNumber: version,
      items: [
        { itemNumber: 1, checks: [{ checkCode: 'H222', decisionCode: code }] }
      ]
    })
    simulator.declarations
      .get(mrn)
      .decisions.push(decision(1, 'H01'), decision(2, 'C03'))

    const { $ } = await get(`/cds/declarations/${mrn}/decisions`)
    const earlier = $('details.app-cds-version')

    expect($('h2').first().text()).toBe('Version 2')
    expect(
      $('.app-ched-part__panel > .app-cds-reply .app-tag').text().trim()
    ).toBe('C03 Release')
    expect(earlier).toHaveLength(1)
    expect(earlier.find('summary').text()).toContain('Version 1')
    expect(earlier.find('summary').text()).toContain('Decision 1')
    expect(earlier.find('.app-tag').text().trim()).toBe('H01 Hold')
  })

  test("Should say when BTMS hasn't replied", async () => {
    const [mrn] = await createDeclarations(1)

    const { $ } = await get(`/cds/declarations/${mrn}/decisions`)

    expect($('.app-empty').text()).toContain(
      "BTMS hasn't replied to this version yet"
    )
  })

  test('Should offer to finalise the latest version, with its latest decision number', async () => {
    const [mrn] = await createDeclarations(1)
    simulator.declarations.get(mrn).decisions.push(
      {
        timestamp: '2026-10-22T10:00:00Z',
        entryVersionNumber: 1,
        decisionNumber: 1,
        items: []
      },
      {
        timestamp: '2026-10-22T10:01:00Z',
        entryVersionNumber: 1,
        decisionNumber: 2,
        items: []
      }
    )

    const { statusCode, $ } = await get(`/cds/declarations/${mrn}/finalise`)
    const form = $('[data-module="app-cds-finalisation-form"]')

    expect(statusCode).toBe(statusCodes.ok)
    expect(form.find('input[name="version"]').val()).toBe('1')
    expect(form.find('input[name="decisionNumber"]').val()).toBe('2')
    expect(form.find('select[name="finalState"] option:selected').val()).toBe(
      '0'
    )
    expect(form.attr('data-action')).toBe(
      `/cds/api/declarations/${mrn}/finalisations`
    )
  })

  test('Should send a finalisation in the contract shape, and list it', async () => {
    const [mrn] = await createDeclarations(1)

    const response = await send(
      'POST',
      `/cds/api/declarations/${mrn}/finalisations`,
      { version: 1, finalState: '0', manualAction: 'N', decisionNumber: 2 }
    )
    const { $ } = await get(`/cds/declarations/${mrn}/finalise?finalised=true`)

    expect(response.statusCode).toBe(201)
    expect(
      simulator.declarations.get(mrn).finalisations[0].finalisation
    ).toEqual({
      serviceHeader: { sourceSystem: 'CDS', destinationSystem: 'ALVS' },
      header: {
        entryReference: mrn,
        entryVersionNumber: 1,
        finalState: '0',
        manualAction: 'N',
        decisionNumber: 2
      }
    })
    expect($('.app-result').text()).toContain('Finalisation sent')
    expect($('tbody').last().text()).toContain('0 – Cleared')
  })

  test('Should leave the decision number out when none is given', async () => {
    const [mrn] = await createDeclarations(1)

    await send('POST', `/cds/api/declarations/${mrn}/finalisations`, {
      version: 1,
      finalState: '1',
      manualAction: 'Y'
    })

    expect(
      simulator.declarations.get(mrn).finalisations[0].finalisation.header
    ).not.toHaveProperty('decisionNumber')
  })

  test("Should pass on the simulator's refusal of a second finalisation", async () => {
    const [mrn] = await createDeclarations(1)
    const finalisation = { version: 1, finalState: '0', manualAction: 'N' }
    await send(
      'POST',
      `/cds/api/declarations/${mrn}/finalisations`,
      finalisation
    )

    const response = await send(
      'POST',
      `/cds/api/declarations/${mrn}/finalisations`,
      finalisation
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.payload).detail).toContain('already exists')
  })

  test('Should refuse a final state the contract lacks', async () => {
    const [mrn] = await createDeclarations(1)

    const response = await send(
      'POST',
      `/cds/api/declarations/${mrn}/finalisations`,
      { version: 1, finalState: '9', manualAction: 'N' }
    )

    expect(response.statusCode).toBe(statusCodes.badRequest)
  })

  test.each(['', '/decisions', '/finalise'])(
    'Should say so when there is no declaration for the tab %s',
    async (tab) => {
      const { statusCode } = await get(
        `/cds/declarations/26GBNOTHERE0000000${tab}`
      )

      expect(statusCode).toBe(statusCodes.notFound)
    }
  )

  test('Should save a scenario in the simulator', async () => {
    const response = await send('PUT', '/cds/api/scenarios/horses', {
      name: 'Horses',
      model: request
    })

    expect(response.statusCode).toBe(200)
    expect(simulator.scenarios.get('horses').name).toBe('Horses')
  })

  test('Should serve the tariff as the commodity picker tree', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/cds/api/commodities'
    })
    const tree = JSON.parse(response.payload)

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toContain('max-age=86400')
    expect(tree[0].slice(0, 3)).toEqual(['0100000000', 'LIVE ANIMALS', 0])
  })
})
