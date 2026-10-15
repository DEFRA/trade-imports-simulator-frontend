import { readFileSync } from 'node:fs'

function load(id) {
  return JSON.parse(
    readFileSync(new URL(`./${id}.json`, import.meta.url), 'utf-8')
  )
}

// Complete control models for POST /control/cheds, one JSON file each so they're easy to copy into
// curl or Postman. The first is the stub TestKit's AChedA(). None sets a status: the simulator
// starts every CHED as NEW, as TRACES does.
export const scenarios = [
  { id: 'ched-a-live-horses', name: 'CHED-A: live horses, by weight' },
  {
    id: 'ched-a-cattle-by-head',
    name: 'CHED-A: cattle for slaughter, by head'
  },
  { id: 'ched-p-milk', name: 'CHED-P: milk' },
  { id: 'ched-pp-oranges', name: 'CHED-PP: navel oranges' }
].map((scenario) => ({ ...scenario, model: load(scenario.id) }))

// A blank CHED of one type: the simulator's seeded exporter and importer, arriving in Northern
// Ireland. Anything else takes the form's first option, with one commodity line to start.
export function blankChed(type) {
  return {
    exchangedDocument: { includedNote: { CHED_TYPE: type } },
    specifiedConsignment: {
      importCountry: 'XI',
      consignorParty: {
        identifier: '770198',
        postalAddress: { countryId: 'XI' }
      },
      consigneeParty: {
        identifier: '899361',
        postalAddress: { countryId: 'XI' }
      },
      unloadingBaseportLocation: { countryId: 'XI' },
      includedConsignmentItem: {
        natureIdCargo: '12',
        includedTradeLineItem: [{}]
      }
    }
  }
}
