import Joi from 'joi'

import {
  createIuuNotification,
  getIuuNotification,
  getNextId,
  listIuuNotifications,
  updateIuuNotification
} from '#/server/common/clients/fis-simulator.js'
import { apiRoute, relay } from '#/server/common/helpers/api-route.js'
import { pagination } from '#/server/common/helpers/pagination.js'
import { iuuOptions, iuuOptionsWithNone } from './iuu-options.js'

// The simulator takes any reference in its path; this keeps to ones that are safe in a URL, such as
// IUU.GB.2026.0000001, or the "1" it issues first.
const reference = Joi.string()
  .trim()
  .pattern(/^[A-Za-z0-9._-]+$/)
  .max(100)

const referenceParam = {
  params: Joi.object({ reference: reference.required() })
}

// Null is a notification with no outcome yet, as the form's None sends it.
const iuuOption = Joi.string()
  .valid(...iuuOptions.map(({ value }) => value))
  .allow(null)
  .required()

const pageSize = 10

// A notification as the pages show it.
function summarise({ id, created, updated, iuuNotification }) {
  return {
    reference: iuuNotification?.reference ?? id,
    iuuOption: iuuNotification?.iuuOption,
    created,
    updated
  }
}

// Every notification in the simulator, newest created first, a page at a time. The simulator doesn't
// say whether more follow, so each page asks for one more than it shows.
export const fisController = {
  options: {
    validate: {
      query: Joi.object({ page: Joi.number().integer().min(1).default(1) })
    }
  },
  async handler(request, h) {
    const { page } = request.query
    const notifications = await listIuuNotifications({
      skip: (page - 1) * pageSize,
      limit: pageSize + 1
    })
    return h.view('fis/index', {
      pageTitle: 'IUU notifications',
      notifications: notifications.slice(0, pageSize).map(summarise),
      pastFirstPage: page > 1,
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
      iuuOptions: iuuOptionsWithNone
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
    const notification = summarise(
      await getIuuNotification(request.params.reference)
    )
    return h.view('fis/notification', {
      pageTitle: notification.reference,
      notification,
      created: request.query.created,
      updated: request.query.updated,
      // One created with none keeps None on offer, so the form shows what it holds.
      iuuOptions: notification.iuuOption ? iuuOptions : iuuOptionsWithNone
    })
  }
}

export const nextIdApiController = {
  options: { tags: ['api'] },
  handler: (_request, h) => relay(h, getNextId)
}

export const createNotificationApiController = {
  options: apiRoute({ ...referenceParam, payload: Joi.object({ iuuOption }) }),
  handler: (request, h) =>
    relay(
      h,
      () => createIuuNotification(request.params.reference, request.payload),
      201
    )
}

export const updateNotificationApiController = {
  options: apiRoute({ ...referenceParam, payload: Joi.object({ iuuOption }) }),
  handler: (request, h) =>
    relay(h, () =>
      updateIuuNotification(request.params.reference, request.payload)
    )
}
