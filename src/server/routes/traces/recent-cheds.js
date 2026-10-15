// The CHEDs this browser session created, newest first. The simulator has no "list mine", and its
// search is by update time, so the session is what remembers them.
const key = 'recentCheds'
const limit = 20

export function rememberChed(request, id) {
  const ids = request.yar.get(key) ?? []
  request.yar.set(
    key,
    [id, ...ids.filter((known) => known !== id)].slice(0, limit)
  )
}

export function recentChedIds(request) {
  return request.yar.get(key) ?? []
}
