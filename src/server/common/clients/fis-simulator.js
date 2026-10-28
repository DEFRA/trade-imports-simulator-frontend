import { config } from '#/config/config.js'
import { jsonApi } from './json-api.js'

// trade-imports-fis-simulator-api: it stores IUU notifications as the Fish Import Service would send
// them, and publishes each create and update to BTMS.
const send = jsonApi({
  service: 'FIS simulator',
  setting: 'FIS_SIMULATOR_URL',
  baseUrl: () => config.get('fisSimulator.baseUrl')
})

const json = (method, body) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
})

const notification = (reference) =>
  `/iuunotification/${encodeURIComponent(reference)}`

/** The reference to use next, one more than the largest stored: `{ nextId }`. */
export function getNextId() {
  return send('/admin/nextId')
}

/**
 * Notifications by when they were created, newest first, skipping the first `skip`: `[{ id, etag,
 * created, updated, iuuNotification: { reference, lastUpdated, iuuOption } }]`.
 */
export function listIuuNotifications({ skip = 0, limit = 10 } = {}) {
  return send(
    `/iuunotification?${new URLSearchParams({ skip, limit, sortOrder: 'desc' })}`
  )
}

/** One notification: `{ id, etag, created, updated, iuuNotification: { reference, lastUpdated, iuuOption } }`. */
export function getIuuNotification(reference) {
  return send(notification(reference))
}

/** Creates a notification under this reference, refused (409) if it exists: the `Created` event it published. */
export function createIuuNotification(reference, { iuuOption }) {
  return send(notification(reference), json('POST', { iuuOption }))
}

/** Changes a notification's IUU option: the `Updated` event it published. */
export function updateIuuNotification(reference, { iuuOption }) {
  return send(notification(reference), json('PUT', { iuuOption }))
}
