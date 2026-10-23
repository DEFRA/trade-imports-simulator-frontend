import { vi } from 'vitest'

import { scenarios as seededScenarios } from './scenarios/index.js'

// Small versions of the stub's seed lists, enough to render the CHED form.
export const lookups = {
  ched_type: [
    { code: 'A', name: 'CHED-A - Common Health Entry Document for Animal' },
    {
      code: 'P',
      name: 'CHED-P - Common Health Entry Document for Animal Product'
    },
    {
      code: 'PP',
      name: 'CHED-PP - Common Health Entry Document for Plant Product'
    },
    {
      code: 'D',
      name: 'CHED-D - Common Health Entry Document for Feed and Food of Non-Animal Origin'
    }
  ],
  ched_consignment_clause: [
    { code: 'FREE_CIRCULATION', name: 'For free circulation' },
    { code: 'FATTENING', name: 'Fattening' }
  ],
  authorities: [{ code: 'GBBEL', name: 'Belfast Port BCP' }],
  operators: [
    { code: '899361', name: 'Simulator Trading Ltd' },
    { code: '770198', name: 'Simulator Exporters Ltd' }
  ],
  country: [
    { code: 'AF', name: 'Afghanistan' },
    { code: 'XI', name: 'United Kingdom (Northern Ireland)' }
  ],
  cn_code: [{ code: '0101', name: 'Live horses, asses, mules and hinnies' }]
}

// A fake stub behind the global fetch mock (.vite/setup-files.js): it serves the lookups above, and
// creates and reads CHEDs in memory. Like the real one, it refuses a CN code it hasn't seeded.
// The CN code the stub would refuse, if any.
function unknownCnCode(model) {
  const lines =
    model.specifiedConsignment?.includedConsignmentItem
      ?.includedTradeLineItem ?? []
  return lines
    .map((line) => line.applicableClassification?.CN)
    .find((cn) => !lookups.cn_code.some(({ code }) => code === cn))
}

// A fake stub behind the global fetch mock (.vite/setup-files.js): it serves the lookups above, and
// creates, reads, replaces and lists CHEDs in memory, serves the commodity trees it's given, and lists and
// saves scenarios, starting with the stub's own. Like the real one, it refuses a CN code it hasn't seeded.
export function mockSimulator({ trees = {} } = {}) {
  const cheds = new Map()
  const scenarios = new Map(
    seededScenarios.map((scenario) => [scenario.id, scenario])
  )
  const json = (body, status = 200) => ({
    status,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  })
  const problem = (status, detail) => json({ status, detail }, status)
  // Ticks rather than the clock, so two CHEDs stored in the same millisecond still list in order.
  let tick = 0
  const stamp = () =>
    new Date(Date.UTC(2026, 3, 22, 12, 0, tick++)).toISOString()
  const refused = (cn) =>
    problem(400, `Code '${cn}' is not in code list 'cn_code'.`)

  vi.mocked(fetch).mockResponse(async (request) => {
    const path = new URL(request.url).pathname
    const list = path.match(/^\/control\/lookups\/(.+)$/)?.[1]
    const id = decodeURIComponent(
      path.match(/^\/control\/cheds\/(.+)$/)?.[1] ?? ''
    )

    const treeType = path.match(/^\/control\/commodity-trees\/(.+)$/)?.[1]
    if (treeType) {
      return trees[treeType]
        ? json({ chedType: treeType, nodes: trees[treeType] })
        : problem(
            404,
            `No commodity tree is loaded for CHED type '${treeType}'.`
          )
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
    if (list) {
      return lookups[list]
        ? json(lookups[list])
        : problem(404, `No code list '${list}' is seeded.`)
    }
    if (path === '/control/cheds' && request.method === 'GET') {
      const query = new URL(request.url).searchParams
      const page = Number(query.get('page') ?? 1)
      const pageSize = Number(query.get('pageSize') ?? 20)
      const newestFirst = [...cheds.values()].sort((a, b) =>
        a.updated < b.updated ? 1 : -1
      )
      return json({
        page,
        pageSize,
        hasMore: newestFirst.length > page * pageSize,
        items: newestFirst.slice((page - 1) * pageSize, page * pageSize)
      })
    }
    if (path === '/control/cheds' && request.method === 'POST') {
      const model = await request.json()
      const cn = unknownCnCode(model)
      if (cn !== undefined) return refused(cn)

      const type = model.exchangedDocument.includedNote.CHED_TYPE
      const created = {
        id: `CHED${type}.XI.2026.${String(cheds.size + 1).padStart(7, '0')}`,
        accessible: true,
        updated: stamp(),
        certificate: model
      }
      cheds.set(created.id, created)
      return json(created, 201)
    }
    if (id && !cheds.has(id)) {
      return problem(404, `No CHED '${id}' exists in the simulator.`)
    }
    if (id && request.method === 'GET') {
      return json(cheds.get(id))
    }
    if (id && request.method === 'PUT') {
      const model = await request.json()
      const cn = unknownCnCode(model)
      if (cn !== undefined) return refused(cn)

      cheds.set(id, {
        id,
        accessible: true,
        updated: stamp(),
        certificate: model
      })
      return json(cheds.get(id))
    }
    return problem(404, `Not faked: ${request.method} ${path}`)
  })

  return { cheds, scenarios }
}
