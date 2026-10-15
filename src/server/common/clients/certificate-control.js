import { config } from '#/config/config.js'

// The TRACES NT stub's control API. It knows only a base URL, so a later control API with the same
// contract (over real TRACES, through the POC) is a different URL rather than a different client.
const baseUrl = () => config.get('tracesSimulator.baseUrl')

export class ControlApiError extends Error {
  constructor(status, problem) {
    super(
      problem?.detail ?? problem?.title ?? `The simulator returned ${status}`
    )
    this.status = status
    this.problem = problem
  }
}

async function send(path, options) {
  const url = `${baseUrl()}/control${path}`
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: { accept: 'application/json', ...options?.headers }
    })
  } catch (error) {
    throw new ControlApiError(502, {
      detail: `Could not reach the simulator at ${baseUrl()}: ${error.cause?.code ?? error.message}`
    })
  }
  const body = await response.text()
  const isJson = response.headers.get('content-type')?.includes('json')
  const json = isJson && body ? JSON.parse(body) : undefined

  // Anything but JSON means something other than the stub answered, e.g. another service on the port.
  if (body && !isJson) {
    throw new ControlApiError(502, {
      detail: `${url} answered ${response.status} with ${response.headers.get('content-type') ?? 'no content type'}, not the stub's JSON. Is TRACES_SIMULATOR_URL (${baseUrl()}) the stub?`
    })
  }
  if (!response.ok) {
    throw new ControlApiError(response.status, json)
  }
  return json
}

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
