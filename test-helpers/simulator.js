import { vi } from 'vitest'

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
  cn_code: [{ code: '0101', name: 'Live horses, asses, mules and hinnies' }],
  refusal_reason: [{ code: 'MISSING_CERTIFICATE', name: 'Missing certificate' }]
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
// creates, reads and replaces CHEDs in memory. Like the real one, it refuses a CN code it hasn't seeded.
export function mockSimulator() {
  const cheds = new Map()
  const json = (body, status = 200) => ({
    status,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  })
  const problem = (status, detail) => json({ status, detail }, status)
  const refused = (cn) =>
    problem(400, `Code '${cn}' is not in code list 'cn_code'.`)

  vi.mocked(fetch).mockResponse(async (request) => {
    const path = new URL(request.url).pathname
    const list = path.match(/^\/control\/lookups\/(.+)$/)?.[1]
    const id = decodeURIComponent(
      path.match(/^\/control\/cheds\/(.+)$/)?.[1] ?? ''
    )

    if (list) {
      return lookups[list]
        ? json(lookups[list])
        : problem(404, `No code list '${list}' is seeded.`)
    }
    if (path === '/control/cheds' && request.method === 'POST') {
      const model = await request.json()
      const cn = unknownCnCode(model)
      if (cn !== undefined) return refused(cn)

      const type = model.exchangedDocument.includedNote.CHED_TYPE
      const created = {
        id: `CHED${type}.XI.2026.${String(cheds.size + 1).padStart(7, '0')}`,
        accessible: true,
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

      cheds.set(id, { id, accessible: true, certificate: model })
      return json(cheds.get(id))
    }
    return problem(404, `Not faked: ${request.method} ${path}`)
  })

  return { cheds }
}
