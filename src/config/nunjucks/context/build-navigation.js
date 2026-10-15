// One entry per upstream system the simulator stands in for. An entry without an href isn't built yet.
export function buildNavigation(request) {
  return [
    {
      text: 'TRACES',
      href: '/traces',
      current: request?.path?.startsWith('/traces') ?? false
    },
    { text: 'IPAFFS' },
    { text: 'CDS' }
  ]
}
