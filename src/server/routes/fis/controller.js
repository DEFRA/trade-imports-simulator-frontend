import Joi from 'joi'

import {
  createIuuNotification,
  deleteIuuNotification,
  getIuuNotification,
  getNextId,
  listIuuNotifications,
  resetFisSimulator,
  updateIuuNotification
} from '#/server/common/clients/fis-simulator.js'
import { apiRoute, relay } from '#/server/common/helpers/api-route.js'
import { pagination } from '#/server/common/helpers/pagination.js'
import {
  iuuCheckOutcomeValues,
  iuuCheckOutcomes
} from './iuu-check-outcomes.js'

// The simulator takes any reference in its path; this keeps to ones that are safe in a URL, such as
// IUU.GB.2026.0000001, or the "1" it issues first.
const reference = Joi.string()
  .trim()
  .pattern(/^[A-Za-z0-9._-]+$/)
  .max(100)

const referenceParam = {
  params: Joi.object({ reference: reference.required() })
}

// Null is a notification with no outcome yet, as the form's None sends it. It must still be sent: the
// simulator refuses a request without it (400).
const iuuCheckOutcome = Joi.string()
  .valid(...iuuCheckOutcomeValues)
  .allow(null)
  .required()

const pageSize = 10

// Every notification in the simulator, newest created first, a page at a time. The simulator doesn't
// say whether more follow, so each page asks for one more than it shows. A delete or reset comes back
// here, and says so.
export const fisController = {
  options: {
    validate: {
      query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        deleted: reference,
        reset: Joi.boolean()
      })
    }
  },
  async handler(request, h) {
    const { page, deleted, reset } = request.query
    const notifications = await listIuuNotifications({
      skip: (page - 1) * pageSize,
      limit: pageSize + 1
    })
    return h.view('fis/index', {
      pageTitle: 'IUU notifications',
      notifications: notifications.slice(0, pageSize),
      pastFirstPage: page > 1,
      deleted,
      reset,
      pagination: pagination(page, notifications.length > pageSize, {
        path: '/fis',
        landmarkLabel: 'IUU notification pages',
        newer: 'newer notifications',
        older: 'older notifications'
      })
    })
  }
}

export const createNotificationController = {
  handler(_request, h) {
    return h.view('fis/create', {
      pageTitle: 'Create an IUU notification',
      iuuCheckOutcomes
    })
  }
}

// "Open a notification" is a plain GET form, so the reference arrives as a query and is moved into the path.
export const openNotificationController = {
  options: {
    validate: { query: Joi.object({ reference: reference.required() }) }
  },
  handler: (request, h) =>
    h.redirect(
      `/fis/notifications/${encodeURIComponent(request.query.reference)}`
    )
}

export const notificationController = {
  options: {
    validate: {
      ...referenceParam,
      query: Joi.object({ created: Joi.boolean(), updated: Joi.boolean() })
    }
  },
  async handler(request, h) {
    const notification = await getIuuNotification(request.params.reference)
    return h.view('fis/notification', {
      pageTitle: notification.reference,
      notification,
      created: request.query.created,
      updated: request.query.updated,
      iuuCheckOutcomes
    })
  }
}

export const nextIdApiController = {
  options: { tags: ['api'] },
  handler: (_request, h) => relay(h, getNextId)
}

export const createNotificationApiController = {
  options: apiRoute({
    ...referenceParam,
    payload: Joi.object({ iuuCheckOutcome })
  }),
  handler: (request, h) =>
    relay(
      h,
      () => createIuuNotification(request.params.reference, request.payload),
      201
    )
}

export const updateNotificationApiController = {
  options: apiRoute({
    ...referenceParam,
    payload: Joi.object({ iuuCheckOutcome })
  }),
  handler: (request, h) =>
    relay(h, () =>
      updateIuuNotification(request.params.reference, request.payload)
    )
}

// A reset or delete can't be undone, so each asks on a page of its own first and acts only on that
// page's form. Neither publishes anything to BTMS.
export const resetController = {
  handler: (_request, h) =>
    h.view('fis/confirm', {
      pageTitle: 'Reset the FIS simulator',
      breadcrumbs: [{ text: 'FIS', href: '/fis' }, { text: 'Reset' }],
      heading: 'Reset the FIS simulator?',
      warning:
        "This deletes every IUU notification in the simulator. It can't be undone.",
      detail:
        'Nothing is published to BTMS. The next ID carries on from the last one issued.',
      action: '/fis/reset',
      confirmText: 'Yes, reset the simulator',
      cancel: '/fis'
    })
}

export const resetActionController = {
  async handler(_request, h) {
    await resetFisSimulator()
    return h.redirect('/fis?reset=true')
  }
}

export const deleteNotificationController = {
  options: { validate: referenceParam },
  async handler(request, h) {
    // Asking the simulator first answers a reference it doesn't hold with a 404, not a confirmation.
    const { reference } = await getIuuNotification(request.params.reference)
    const path = `/fis/notifications/${encodeURIComponent(reference)}`
    return h.view('fis/confirm', {
      pageTitle: `Delete ${reference}`,
      breadcrumbs: [
        { text: 'FIS', href: '/fis' },
        { text: reference, href: path },
        { text: 'Delete' }
      ],
      heading: `Delete ${reference}?`,
      warning:
        "This removes the notification from the simulator. It can't be undone.",
      detail: 'Nothing is published to BTMS.',
      action: `${path}/delete`,
      confirmText: 'Yes, delete it',
      cancel: path
    })
  }
}

export const deleteNotificationActionController = {
  options: { validate: referenceParam },
  async handler(request, h) {
    const { reference } = request.params
    await deleteIuuNotification(reference)
    return h.redirect(`/fis?deleted=${encodeURIComponent(reference)}`)
  }
}
