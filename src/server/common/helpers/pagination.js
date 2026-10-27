// Page links for a list the simulators serve newest first, as appPagination takes them. The
// simulators say only whether another page follows, not how many there are, so the numbers run from
// 1 to the page after this one: 1 … 4 [5] 6. `newer` and `older` name what the previous and next
// links lead to, e.g. "newer CHEDs".
export function pagination(
  page,
  hasMore,
  { path, landmarkLabel, newer, older }
) {
  if (page === 1 && !hasMore) {
    return undefined
  }
  const href = (number) => `${path}?page=${number}`
  const link = (number) => ({
    number,
    href: href(number),
    current: number === page
  })
  const last = hasMore ? page + 1 : page
  const items = [link(1)]
  if (page > 3) {
    items.push({ ellipsis: true })
  }
  for (let number = Math.max(2, page - 1); number <= last; number++) {
    items.push(link(number))
  }
  return {
    landmarkLabel,
    previous: page > 1 ? { href: href(page - 1), labelText: newer } : undefined,
    next: hasMore ? { href: href(page + 1), labelText: older } : undefined,
    items
  }
}
