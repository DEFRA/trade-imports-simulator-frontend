// What the simulators' JSON APIs share: a failure becomes a ControlApiError carrying the simulator's
// own problem, so a page can show its message, and `service` names the simulator for the error page.
// `request` is what was sent ({ method, url, body }), so the error page can say which call failed.
export class ControlApiError extends Error {
  constructor(status, problem, service, request) {
    super(
      problem?.detail ?? problem?.title ?? `The simulator returned ${status}`
    )
    this.status = status
    this.problem = problem
    this.service = service
    this.request = request
  }
}

// ASP.NET answers a plain BadRequest("...") with a JSON string, and a validation failure with
// per-field errors under a generic title. Both become a problem whose detail says what was wrong.
function problemFrom(json) {
  if (typeof json === 'string') return { detail: json }
  if (json?.errors && !json.detail) {
    return { ...json, detail: Object.values(json.errors).flat().join(' ') }
  }
  return json
}

// A sender for one simulator: { service, setting, baseUrl, headers }. `setting` is the environment
// variable that sets `baseUrl`, named when the URL turns out to be wrong.
export function jsonApi({ service, setting, baseUrl, headers = () => ({}) }) {
  return async function send(path, options) {
    const base = baseUrl()
    const url = `${base}${path}`
    const request = {
      method: options?.method ?? 'GET',
      url,
      body: options?.body
    }
    let response
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          accept: 'application/json',
          ...headers(),
          ...options?.headers
        }
      })
    } catch (error) {
      throw new ControlApiError(
        502,
        {
          detail: `Could not reach the simulator at ${base}: ${error.cause?.code ?? error.message}`
        },
        service,
        request
      )
    }
    const body = await response.text()
    const isJson = response.headers.get('content-type')?.includes('json')
    const json = isJson && body ? JSON.parse(body) : undefined

    // Anything but JSON means something other than the simulator answered, e.g. another service on the port.
    if (body && !isJson) {
      throw new ControlApiError(
        502,
        {
          detail: `${url} answered ${response.status} with ${response.headers.get('content-type') ?? 'no content type'}, not the ${service}'s JSON. Is ${setting} (${base}) right?`
        },
        service,
        request
      )
    }
    if (!response.ok) {
      throw new ControlApiError(
        response.status,
        problemFrom(json),
        service,
        request
      )
    }
    return json
  }
}
