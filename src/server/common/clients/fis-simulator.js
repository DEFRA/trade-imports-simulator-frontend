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
 * Notifications by when they were created, newest first, skipping the first `skip`: `[{ reference,
 * lastUpdated, iuuCheckOutcome }]`.
 */
export function listIuuNotifications({ skip = 0, limit = 10 } = {}) {
  return send(
    `/iuunotification?${new URLSearchParams({ skip, limit, sortOrder: 'desc' })}`
  )
}

/** One notification: `{ reference, lastUpdated, iuuCheckOutcome }`. */
export function getIuuNotification(reference) {
  return send(notification(reference))
}

/**
 * Creates a notification under this reference, refused (409) if it exists, and publishes it: the
 * notification as published.
 */
export function createIuuNotification(reference, { iuuCheckOutcome }) {
  return send(notification(reference), json('POST', { iuuCheckOutcome }))
}

/** Changes a notification's IUU check outcome and publishes it: the notification as published. */
export function updateIuuNotification(reference, { iuuCheckOutcome }) {
  return send(notification(reference), json('PUT', { iuuCheckOutcome }))
}

/** Deletes a notification, 404 if there is none. Unlike a create or update, nothing is published to BTMS. */
export function deleteIuuNotification(reference) {
  return send(notification(reference), { method: 'DELETE' })
}

/** Empties the simulator's database. It keeps its reference counter, so the next ID carries on from the last. */
export function resetFisSimulator() {
  return send('/admin/reset', { method: 'POST' })
}
