import { vi } from 'vitest'

// A fake trade-imports-fis-simulator-api behind the global fetch mock (.vite/setup-files.js). Like the
// real one it stores notifications by reference, refuses a reference it holds already (409, as a
// problem), answers an update to one it doesn't hold with a bare 404, and issues the next ID from the
// largest trailing number. It lists them newest created first, by skip and limit, and reads one.
export function mockFisSimulator() {
  const notifications = new Map()
  const json = (body, status = 200) => ({
    status,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  })
  // Ticks rather than the clock, so two notifications stored in the same millisecond still list in order.
  let tick = 0
  const stamp = () =>
    new Date(Date.UTC(2026, 9, 28, 9, 0, tick++)).toISOString()
  const event = (operation, resource) => ({
    resourceId: resource.id,
    resourceType: 'IuuNotification',
    operation,
    resource,
    etag: resource.etag,
    timestamp: resource.updated
  })

  function nextId() {
    const largest = [...notifications.keys()]
      .map((reference) => reference.match(/^(.*?)(\d+)$/))
      .filter(Boolean)
      .sort((a, b) => Number(b[2]) - Number(a[2]))[0]
    if (!largest) return '1'
    const [, prefix, digits] = largest
    return prefix + String(Number(digits) + 1).padStart(digits.length, '0')
  }

  vi.mocked(fetch).mockResponse(async (request) => {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/admin/nextId') return json({ nextId: nextId() })

    if (path === '/iuunotification' && request.method === 'GET') {
      const skip = Number(url.searchParams.get('skip') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 10)
      return json(
        [...notifications.values()]
          .sort((a, b) => (a.created < b.created ? 1 : -1))
          .slice(skip, skip + limit)
      )
    }

    const reference = decodeURIComponent(
      path.match(/^\/iuunotification\/(.+)$/)?.[1] ?? ''
    )
    if (!reference) return { status: 404, body: '' }
    const stored = notifications.get(reference)

    if (request.method === 'POST') {
      if (stored) {
        return json(
          {
            title: 'IUU notification already exists',
            detail: `An IUU notification with reference '${reference}' already exists.`,
            status: 409
          },
          409
        )
      }
      const { iuuOption } = await request.json()
      const now = stamp()
      const created = {
        id: reference,
        etag: `etag-${tick}`,
        created: now,
        updated: now,
        iuuNotification: { reference, lastUpdated: now, iuuOption }
      }
      notifications.set(reference, created)
      return json(event('Created', created), 201)
    }

    if (!stored) return { status: 404, body: '' }

    if (request.method === 'PUT') {
      const { iuuOption } = await request.json()
      const now = stamp()
      stored.etag = `etag-${tick}`
      stored.updated = now
      stored.iuuNotification = { reference, lastUpdated: now, iuuOption }
      return json(event('Updated', stored))
    }
    return json(stored)
  })

  return { notifications }
}
