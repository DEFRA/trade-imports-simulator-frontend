import { vi } from 'vitest'

// A fake trade-imports-fis-simulator-api behind the global fetch mock (.vite/setup-files.js). Like the
// real one it stores notifications by reference as { created, iuuNotification }, answers with the bare
// IuuNotification { reference, lastUpdated, iuuCheckOutcome }, refuses a reference it holds already
// (409, as a problem) or a missing or blank outcome (400, though null is fine), answers an update to one
// it doesn't hold with a bare
// 404, and issues the next ID from the
// largest trailing number. It lists them newest created first, by skip and limit, reads one, deletes
// one (a bare 404 if it doesn't hold it), and empties itself on a reset.
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
  // Null is no outcome yet; a missing or blank one is refused.
  const refuses = (body) =>
    !('iuuCheckOutcome' in body) ||
    (body.iuuCheckOutcome !== null && !String(body.iuuCheckOutcome).trim())
  const outcomeRequired = () =>
    json(
      {
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { iuuCheckOutcome: ['iuuCheckOutcome is required'] }
      },
      400
    )

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

    if (path === '/admin/reset' && request.method === 'POST') {
      notifications.clear()
      return { status: 204, body: null }
    }

    if (path === '/iuunotification' && request.method === 'GET') {
      const skip = Number(url.searchParams.get('skip') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 10)
      return json(
        [...notifications.values()]
          .sort((a, b) => (a.created < b.created ? 1 : -1))
          .slice(skip, skip + limit)
          .map(({ iuuNotification }) => iuuNotification)
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
      const body = await request.json()
      if (refuses(body)) return outcomeRequired()
      const { iuuCheckOutcome } = body
      const now = stamp()
      const iuuNotification = { reference, lastUpdated: now, iuuCheckOutcome }
      notifications.set(reference, { created: now, iuuNotification })
      return json(iuuNotification, 201)
    }

    if (!stored) return { status: 404, body: '' }

    if (request.method === 'PUT') {
      const body = await request.json()
      if (refuses(body)) return outcomeRequired()
      const { iuuCheckOutcome } = body
      stored.iuuNotification = {
        reference,
        lastUpdated: stamp(),
        iuuCheckOutcome
      }
      return json(stored.iuuNotification)
    }

    if (request.method === 'DELETE') {
      notifications.delete(reference)
      return { status: 204, body: null }
    }
    return json(stored.iuuNotification)
  })

  return { notifications }
}
