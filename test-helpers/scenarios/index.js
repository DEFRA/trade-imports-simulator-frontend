import { readFileSync } from 'node:fs'

function load(id) {
  return JSON.parse(
    readFileSync(new URL(`./${id}.json`, import.meta.url), 'utf-8')
  )
}

// Copies of the scenarios the stub seeds (src/Api.TradeTracesNTStub/Scenarios), for tests to create
// CHEDs from and for the fake simulator to serve. The first is the stub TestKit's AChedA().
export const scenarios = [
  { id: 'ched-a-live-horses', name: 'CHED-A: live horses' },
  {
    id: 'ched-a-cattle-by-head',
    name: 'CHED-A: cattle for slaughter, by head'
  },
  { id: 'ched-p-milk', name: 'CHED-P: milk' },
  { id: 'ched-pp-oranges', name: 'CHED-PP: navel oranges' }
].map((scenario) => ({ ...scenario, model: load(scenario.id) }))
