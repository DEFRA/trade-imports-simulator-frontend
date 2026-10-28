import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { mockFisSimulator } from '#/test-helpers/fis-simulator.js'

describe('FIS routes', () => {
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
    simulator = mockFisSimulator()
  })

  async function get(url) {
    const response = await server.inject({ method: 'GET', url })
    return { ...response, $: load(response.payload) }
  }

  // A browser session as the create page starts one: its cookies, and the crumb from the page.
  async function session() {
    const { $, headers } = await get('/fis/notifications/new')
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

  const create = (reference, iuuOption = 'IUUOK') =>
    send('POST', `/fis/api/notifications/${reference}`, { iuuOption })

  const rowsOf = ($) =>
    $('tbody tr')
      .map((_, row) => $(row).text().replace(/\s+/g, ' ').trim())
      .get()

  describe('Notification list', () => {
    test('Should offer to create or open a notification', async () => {
      const { statusCode, $ } = await get('/fis')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('title').text().trim()).toBe(
        'IUU notifications | Trade imports simulator'
      )
      expect($('a[href="/fis/notifications/new"]').text()).toBe(
        'Create an IUU notification'
      )
      expect(
        $('form[action="/fis/notifications/open"] input[name="reference"]')
      ).toHaveLength(1)
      expect($('.app-empty').text()).toContain('None yet')
    })

    test('Should not page a list that fits on one page', async () => {
      await create('IUU.GB.2026.0000001')

      const { $ } = await get('/fis')

      expect(rowsOf($)).toHaveLength(1)
      expect($('.app-pagination')).toHaveLength(0)
    })

    test('Should page through older notifications, 10 at a time', async () => {
      for (let i = 1; i <= 21; i++) {
        await create(`IUU.GB.2026.${String(i).padStart(7, '0')}`)
      }

      const first = await get('/fis')
      const third = await get('/fis?page=3')
      const past = await get('/fis?page=4')

      expect(first.$('a[rel="next"]').attr('href')).toBe('/fis?page=2')
      expect(first.$('a[rel="prev"]')).toHaveLength(0)
      expect(rowsOf(third.$)).toHaveLength(1)
      expect(rowsOf(third.$)[0]).toContain('IUU.GB.2026.0000001')
      expect(third.$('a[rel="prev"]').attr('href')).toBe('/fis?page=2')
      expect(third.$('a[rel="next"]')).toHaveLength(0)
      expect(past.$('.app-empty').text()).toBe('No more notifications.')
    })

    test('Should list the last 10 created, newest first', async () => {
      for (let i = 1; i <= 11; i++) {
        const reference = `IUU.GB.2026.${String(i).padStart(7, '0')}`
        expect((await create(reference)).statusCode).toBe(201)
      }
      await send('PUT', '/fis/api/notifications/IUU.GB.2026.0000011', {
        iuuOption: 'IUUNA'
      })

      const { $ } = await get('/fis')
      const rows = rowsOf($)

      expect(rows).toHaveLength(10)
      expect(rows[0]).toBe(
        'IUU.GB.2026.0000011 IUUNA 28 Oct 2026 09:00 28 Oct 2026 09:00'
      )
      expect(rows.at(-1)).toContain('IUU.GB.2026.0000002')
      expect(
        $('tbody a[href="/fis/notifications/IUU.GB.2026.0000011"]')
      ).toHaveLength(1)
    })

    test('Should move the reference from the open form into the path', async () => {
      const { statusCode, headers } = await get(
        '/fis/notifications/open?reference=+IUU.GB.2026.0000001+'
      )

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/fis/notifications/IUU.GB.2026.0000001')
    })

    test('Should refuse a reference that is not safe in a URL', async () => {
      const { statusCode } = await get(
        '/fis/notifications/open?reference=IUU%2F1'
      )

      expect(statusCode).toBe(statusCodes.badRequest)
    })
  })

  describe('Create a notification', () => {
    test('Should ask for a reference, offer the next ID, and offer the IUU options', async () => {
      const { $ } = await get('/fis/notifications/new')
      const form = $('form[data-module="app-iuu-notification-form"]')

      expect(form.attr('data-method')).toBe('POST')
      expect(form.find('input[name="reference"]').attr('type')).toBe('text')
      expect(form.find('button[data-next-id]').text().trim()).toBe(
        'Use next ID'
      )
      expect(form.find('button[data-next-id]').attr('type')).toBe('button')
      expect(
        form
          .find('select[name="iuuOption"] option')
          .map((_, o) => $(o).attr('value'))
          .get()
      ).toEqual(['', 'IUUOK', 'IUUNA', 'IUUNotCompliant'])
      expect(form.find('select[name="iuuOption"] option').first().text()).toBe(
        'None'
      )
    })

    test('Should send None as a null IUU option', async () => {
      const { statusCode } = await create('IUU.GB.2026.0000001', null)

      expect(statusCode).toBe(201)
      expect(
        simulator.notifications.get('IUU.GB.2026.0000001').iuuNotification
          .iuuOption
      ).toBeNull()

      const list = await get('/fis')
      expect(rowsOf(list.$)[0]).toContain('IUU.GB.2026.0000001 None')

      const { $ } = await get('/fis/notifications/IUU.GB.2026.0000001')
      // Nothing marked selected, so the select opens on its first option, None.
      expect($('select[name="iuuOption"] option[selected]')).toHaveLength(0)
      expect($('select[name="iuuOption"] option').first().text()).toBe('None')
    })

    test("Should relay the simulator's next ID", async () => {
      await create('IUU.GB.2026.0000041')

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/fis/api/next-id'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(JSON.parse(payload)).toEqual({ nextId: 'IUU.GB.2026.0000042' })
    })

    test('Should relay a new notification and the event the simulator published', async () => {
      const { statusCode, payload } = await create(
        'IUU.GB.2026.0000001',
        'IUUNotCompliant'
      )

      expect(statusCode).toBe(201)
      expect(JSON.parse(payload)).toMatchObject({
        operation: 'Created',
        resourceId: 'IUU.GB.2026.0000001'
      })
      expect(
        simulator.notifications.get('IUU.GB.2026.0000001').iuuNotification
          .iuuOption
      ).toBe('IUUNotCompliant')
    })

    test("Should pass on the simulator's refusal of a reference it holds", async () => {
      await create('IUU.GB.2026.0000001')

      const { statusCode, payload, headers } = await create(
        'IUU.GB.2026.0000001'
      )

      expect(statusCode).toBe(409)
      expect(headers['content-type']).toContain('application/problem+json')
      expect(JSON.parse(payload).detail).toBe(
        "An IUU notification with reference 'IUU.GB.2026.0000001' already exists."
      )
    })

    test('Should refuse an IUU option the form does not offer', async () => {
      const { statusCode } = await create('IUU.GB.2026.0000001', 'MAYBE')

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(simulator.notifications.size).toBe(0)
    })
  })

  describe('A notification', () => {
    test('Should show it, with a form to update its IUU option', async () => {
      await create('IUU.GB.2026.0000001', 'IUUNA')

      const { statusCode, $ } = await get(
        '/fis/notifications/IUU.GB.2026.0000001?created=true'
      )
      const form = $('form[data-module="app-iuu-notification-form"]')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1').text()).toBe('IUU.GB.2026.0000001')
      expect($('.app-result').text()).toContain('Created.')
      expect($('.app-summary-list').text()).toContain('IUUNA')
      expect(form.attr('data-method')).toBe('PUT')
      expect(form.find('input[name="reference"]').attr('type')).toBe('hidden')
      expect(form.find('button[data-next-id]')).toHaveLength(0)
      expect(form.find('select[name="iuuOption"] option[selected]').val()).toBe(
        'IUUNA'
      )
    })

    test('Should say it was saved after an update', async () => {
      await create('IUU.GB.2026.0000001')

      const { $ } = await get(
        '/fis/notifications/IUU.GB.2026.0000001?updated=true'
      )

      expect($('.app-result').text()).toContain('Saved.')
    })

    test('Should relay an update and the event the simulator published', async () => {
      await create('IUU.GB.2026.0000001')

      const { statusCode, payload } = await send(
        'PUT',
        '/fis/api/notifications/IUU.GB.2026.0000001',
        { iuuOption: 'IUUNotCompliant' }
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(JSON.parse(payload).operation).toBe('Updated')
      expect(
        simulator.notifications.get('IUU.GB.2026.0000001').iuuNotification
          .iuuOption
      ).toBe('IUUNotCompliant')
    })

    test('Should pass on a 404 for an update to a notification the simulator lacks', async () => {
      const { statusCode } = await send(
        'PUT',
        '/fis/api/notifications/IUU.GB.2026.0000009',
        { iuuOption: 'IUUOK' }
      )

      expect(statusCode).toBe(statusCodes.notFound)
    })

    test('Should answer 404 for a notification the simulator lacks', async () => {
      const { statusCode, $ } = await get(
        '/fis/notifications/IUU.GB.2026.0000009'
      )

      expect(statusCode).toBe(statusCodes.notFound)
      expect($('main').text()).toContain('The FIS simulator')
    })
  })
})
