// A blank clearance request: what every one has, plus a start for each header field so the form
// can be sent as it opens. The form adds an item, and the simulator issues the MRN, version,
// correlation ID and timestamp.
export function blankDeclaration() {
  return {
    serviceHeader: { sourceSystem: 'CDS', destinationSystem: 'ALVS' },
    header: {
      declarationType: 'S',
      declarantId: 'GB999000000001',
      dispatchCountryCode: 'FR',
      goodsLocationCode: 'LGPLGPLGP'
    },
    items: []
  }
}
