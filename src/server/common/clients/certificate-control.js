import { config } from '#/config/config.js'
import { jsonApi } from './json-api.js'

// The TRACES NT stub's control API. It knows only a base URL, so a later control API with the same
// contract (over real TRACES, through the POC) is a different URL rather than a different client.
const control = jsonApi({
  service: 'TRACES simulator',
  setting: 'TRACES_SIMULATOR_URL',
  baseUrl: () => config.get('tracesSimulator.baseUrl')
})
const send = (path, options) => control(`/control${path}`, options)

/** One seeded code list, e.g. `cn_code`, as `[{ code, name, alias }]`. */
export function getLookup(list) {
  return send(`/lookups/${encodeURIComponent(list)}`)
}

/** Creates a CHED. The simulator issues the ID: `{ id, accessible, certificate }`. */
export function createChed(model) {
  return send('/cheds', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(model)
  })
}

/** One page of every CHED, newest first: `{ page, pageSize, hasMore, items: [{ id, accessible, updated, certificate }] }`. */
export function listCheds({ page = 1, pageSize = 20 } = {}) {
  return send(`/cheds?${new URLSearchParams({ page, pageSize })}`)
}

/** The model a CHED was built from, after any patches: `{ id, accessible, certificate }`. */
export function getChed(id) {
  return send(`/cheds/${encodeURIComponent(id)}`)
}

/** Replaces a CHED with this model, keeping its ID: `{ id, accessible, certificate }`. */
export function updateChed(id, model) {
  return send(`/cheds/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(model)
  })
}

/** A CHED type's commodity tree, as TRACES publishes it: `{ chedType, treeId, nodes, ... }`. */
export function getCommodityTree(chedType) {
  return send(`/commodity-trees/${encodeURIComponent(chedType)}`)
}

/** Every scenario, by name: `[{ id, name, model }]`. */
export function listScenarios() {
  return send('/scenarios')
}

/** Saves a scenario under this ID, replacing any with it: `{ id, name, model }`. */
export function saveScenario(id, scenario) {
  return send(`/scenarios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(scenario)
  })
}
