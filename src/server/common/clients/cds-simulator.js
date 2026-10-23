import { config } from '#/config/config.js'
import { jsonApi } from './json-api.js'

// trade-imports-cds-simulator-api: it stores what CDS would send and forwards it to BTMS. Its inbound
// endpoints are open, as CDS's are; its reads need Basic auth, so every call carries it.
const send = jsonApi({
  service: 'CDS simulator',
  setting: 'CDS_SIMULATOR_URL',
  baseUrl: () => config.get('cdsSimulator.baseUrl'),
  headers: () => ({
    authorization: `Basic ${Buffer.from(
      `${config.get('cdsSimulator.clientId')}:${config.get('cdsSimulator.secret')}`
    ).toString('base64')}`
  })
})

const json = (method, body) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
})

/**
 * Submits a clearance request, as the contract's JSON. Without an MRN the simulator issues one, as
 * version 1; with an MRN and a version it's an amendment. `{ id, timestamp, mrn, entryVersionNumber, xml }`.
 */
export function createClearanceRequest(request) {
  return send(
    '/ws/CDS/defra/alvsclearancerequestinbound/v1',
    json('POST', request)
  )
}

/** Submits a finalisation, as the contract's JSON: `{ id, timestamp, mrn, entryVersionNumber, xml }`. */
export function createFinalisation(finalisation) {
  return send(
    '/ws/CDS/defra/alvsfinalisationrequestinbound/v1',
    json('POST', finalisation)
  )
}

/** One page of declarations, one per MRN, most recently sent first: `{ page, pageSize, hasMore, items: [{ mrn, entryVersionNumber, timestamp }] }`. */
export function listDeclarations({ page = 1, pageSize = 20 } = {}) {
  return send(
    `/control/clearance-requests?${new URLSearchParams({ page, pageSize })}`
  )
}

/**
 * Everything the simulator holds for an MRN, each list in time order: `{ mrn, versions: [{
 * entryVersionNumber, timestamp, request }], finalisations: [{ entryVersionNumber, timestamp,
 * finalisation }], decisions: [{ timestamp, entryVersionNumber, decisionNumber, items }], errors:
 * [{ timestamp, entryVersionNumber, errors }] }`.
 */
export function getDeclaration(mrn) {
  return send(`/control/clearance-requests/${encodeURIComponent(mrn)}`)
}

/** Every scenario, by name: `[{ id, name, model }]`. */
export function listScenarios() {
  return send('/control/scenarios')
}

/** Saves a scenario under this ID, replacing any with it: `{ id, name, model }`. */
export function saveScenario(id, scenario) {
  return send(
    `/control/scenarios/${encodeURIComponent(id)}`,
    json('PUT', scenario)
  )
}
