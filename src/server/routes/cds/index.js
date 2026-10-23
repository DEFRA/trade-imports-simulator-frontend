import {
  amendDeclarationController,
  cdsController,
  commoditiesApiController,
  createClearanceRequestApiController,
  createDeclarationController,
  createFinalisationApiController,
  declarationController,
  decisionsController,
  finaliseController,
  openDeclarationController,
  saveScenarioApiController
} from './controller.js'

export const cds = {
  plugin: {
    name: 'cds',
    register(server) {
      server.route([
        { method: 'GET', path: '/cds', ...cdsController },
        {
          method: 'GET',
          path: '/cds/declarations/new',
          ...createDeclarationController
        },
        {
          method: 'GET',
          path: '/cds/declarations/open',
          ...openDeclarationController
        },
        {
          method: 'GET',
          path: '/cds/declarations/{mrn}',
          ...declarationController
        },
        {
          method: 'GET',
          path: '/cds/declarations/{mrn}/amend',
          ...amendDeclarationController
        },
        {
          method: 'GET',
          path: '/cds/declarations/{mrn}/decisions',
          ...decisionsController
        },
        {
          method: 'GET',
          path: '/cds/declarations/{mrn}/finalise',
          ...finaliseController
        },
        {
          method: 'POST',
          path: '/cds/api/clearance-requests',
          ...createClearanceRequestApiController
        },
        {
          method: 'POST',
          path: '/cds/api/declarations/{mrn}/finalisations',
          ...createFinalisationApiController
        },
        {
          method: 'PUT',
          path: '/cds/api/scenarios/{id}',
          ...saveScenarioApiController
        },
        {
          method: 'GET',
          path: '/cds/api/commodities',
          ...commoditiesApiController
        }
      ])
    }
  }
}
