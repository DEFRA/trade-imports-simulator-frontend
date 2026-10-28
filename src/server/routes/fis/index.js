import {
  createNotificationApiController,
  createNotificationController,
  fisController,
  nextIdApiController,
  notificationController,
  openNotificationController,
  updateNotificationApiController
} from './controller.js'

export const fis = {
  plugin: {
    name: 'fis',
    register(server) {
      server.route([
        { method: 'GET', path: '/fis', ...fisController },
        {
          method: 'GET',
          path: '/fis/notifications/new',
          ...createNotificationController
        },
        {
          method: 'GET',
          path: '/fis/notifications/open',
          ...openNotificationController
        },
        {
          method: 'GET',
          path: '/fis/notifications/{reference}',
          ...notificationController
        },
        { method: 'GET', path: '/fis/api/next-id', ...nextIdApiController },
        {
          method: 'POST',
          path: '/fis/api/notifications/{reference}',
          ...createNotificationApiController
        },
        {
          method: 'PUT',
          path: '/fis/api/notifications/{reference}',
          ...updateNotificationApiController
        }
      ])
    }
  }
}
