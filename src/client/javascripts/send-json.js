// Sends JSON to one of this app's API routes, with the CSRF token they expect as a header. Resolves
// to the response body, or rejects with the message from a problem response (the simulator's own).
export async function sendJson(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': document.querySelector('meta[name="csrf-token"]').content
    },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      json.detail ?? json.message ?? `The request failed (${response.status}).`
    )
  }
  return json
}
