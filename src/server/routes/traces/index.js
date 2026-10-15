import {
  chedController,
  createChedApiController,
  createChedController,
  decideChedApiController,
  updateChedApiController,
  decisionController,
  openChedController,
  recentChedsController
} from './controller.js'

export const traces = {
  plugin: {
    name: 'traces',
    register(server) {
      server.route([
        { method: 'GET', path: '/traces', ...recentChedsController },
        { method: 'GET', path: '/traces/cheds', ...openChedController },
        { method: 'GET', path: '/traces/cheds/new', ...createChedController },
        {
          method: 'POST',
          path: '/traces/api/cheds',
          ...createChedApiController
        },
        {
          method: 'PUT',
          path: '/traces/api/cheds/{id}',
          ...updateChedApiController
        },
        {
          method: 'POST',
          path: '/traces/api/cheds/{id}/decision',
          ...decideChedApiController
        },
        { method: 'GET', path: '/traces/cheds/{id}', ...chedController },
        {
          method: 'GET',
          path: '/traces/cheds/{id}/decision',
          ...decisionController
        }
      ])
    }
  }
}
