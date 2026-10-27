import { vi } from 'vitest'

// A fake trade-imports-cds-simulator-api behind the global fetch mock (.vite/setup-files.js). Like the
// real one it issues MRNs, refuses a caller's correlation ID, refuses a version or finalisation it
// already holds (409, as a JSON string, the way ASP.NET answers Results.Conflict("...")), and wants
// Basic auth on its reads. Each declaration keeps its versions and finalisations; a test can push
// BTMS's replies onto its `decisions` and `errors`, as the gateway would send them.
export function mockCdsSimulator() {
  const declarations = new Map()
  const scenarios = new Map()
  const json = (body, status = 200) => ({
    status,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  })
  let issued = 0
  const nextMrn = () => `26GBFAKE${String(++issued).padStart(10, '0')}`
  // Ticks rather than the clock, so two requests sent in the same millisecond still list in order.
  let tick = 0
  const stamp = () =>
    new Date(Date.UTC(2026, 9, 21, 9, 0, tick++)).toISOString()
  const declaration = (mrn) => {
    if (!declarations.has(mrn)) {
      declarations.set(mrn, {
        versions: [],
        finalisations: [],
        decisions: [],
        errors: []
      })
    }
    return declarations.get(mrn)
  }
  const stored = (mrn, version) =>
    json(
      {
        id: `${mrn}-${version}`,
        mrn,
        entryVersionNumber: version,
        xml: '<xml/>'
      },
      201
    )

  vi.mocked(fetch).mockResponse(async (request) => {
    const url = new URL(request.url)
    const path = url.pathname
    const authorised = request.headers
      .get('authorization')
      ?.startsWith('Basic ')

    if (path === '/ws/CDS/defra/alvsclearancerequestinbound/v1') {
      const body = await request.json()
      const header = body.header ?? {}
      if (body.serviceHeader?.correlationId) {
        return json('ServiceHeader.CorrelationId must not be set', 400)
      }
      const mrn = header.entryReference || nextMrn()
      const version = header.entryReference ? header.entryVersionNumber : 1
      const { versions } = declaration(mrn)
      if (versions.some((v) => v.entryVersionNumber === version)) {
        return json(`Entry ${mrn} with version ${version} already exists`, 409)
      }
      versions.push({
        entryVersionNumber: version,
        timestamp: stamp(),
        request: {
          ...structuredClone(body),
          header: {
            ...header,
            entryReference: mrn,
            entryVersionNumber: version
          }
        }
      })
      return stored(mrn, version)
    }

    if (path === '/ws/CDS/defra/alvsfinalisationrequestinbound/v1') {
      const body = await request.json()
      const { entryReference: mrn, entryVersionNumber: version } = body.header
      const { finalisations } = declaration(mrn)
      if (finalisations.some((f) => f.entryVersionNumber === version)) {
        return json(`Entry ${mrn} with version ${version} already exists`, 409)
      }
      finalisations.push({
        entryVersionNumber: version,
        timestamp: stamp(),
        finalisation: body
      })
      return stored(mrn, version)
    }

    if (!authorised) return { status: 401, body: '' }

    if (path === '/control/clearance-requests') {
      const page = Number(url.searchParams.get('page') ?? 1)
      const pageSize = Number(url.searchParams.get('pageSize') ?? 20)
      const newestFirst = [...declarations]
        .filter(([, { versions }]) => versions.length)
        .map(([mrn, { versions }]) => ({ mrn, ...versions.at(-1) }))
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
        .map(({ mrn, entryVersionNumber, timestamp }) => ({
          mrn,
          entryVersionNumber,
          timestamp
        }))
      return json({
        page,
        pageSize,
        hasMore: newestFirst.length > page * pageSize,
        items: newestFirst.slice((page - 1) * pageSize, page * pageSize)
      })
    }

    const mrn = decodeURIComponent(
      path.match(/^\/control\/clearance-requests\/(.+)$/)?.[1] ?? ''
    )
    if (mrn) {
      return declarations.get(mrn)?.versions.length
        ? json({ mrn, ...declarations.get(mrn) })
        : json(`No clearance request for ${mrn} exists in the simulator`, 404)
    }

    if (path === '/control/scenarios') {
      return json(
        [...scenarios.values()].sort((a, b) => (a.name < b.name ? -1 : 1))
      )
    }
    const scenarioId = path.match(/^\/control\/scenarios\/(.+)$/)?.[1]
    if (scenarioId && request.method === 'PUT') {
      const scenario = { id: scenarioId, ...(await request.json()) }
      scenarios.set(scenarioId, scenario)
      return json(scenario)
    }
    return { status: 404, body: '' }
  })

  return { declarations, scenarios }
}
