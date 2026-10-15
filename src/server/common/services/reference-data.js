import { getLookup } from '#/server/common/clients/certificate-control.js'

// The code lists the CHED form offers, read from the stub so they always match what it accepts: it
// rejects any code missing from its seed data. Seed data changes only when the stub is redeployed, so
// one read per process is enough. A failed read isn't kept, so the next request tries again.
const lists = {
  chedTypes: 'ched_type',
  consignmentClauses: 'ched_consignment_clause',
  borderControlPosts: 'authorities',
  operators: 'operators',
  countries: 'country',
  cnCodes: 'cn_code',
  refusalReasons: 'refusal_reason'
}

let cached

async function load() {
  const entries = await Promise.all(
    Object.entries(lists).map(async ([name, list]) => [
      name,
      await getLookup(list)
    ])
  )
  return Object.fromEntries(entries)
}

export function getReferenceData() {
  cached ??= load().catch((error) => {
    cached = undefined
    throw error
  })
  return cached
}
