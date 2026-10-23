import { readFile } from 'node:fs/promises'

// The UK Trade Tariff's commodity codes, for the declaration form's commodity picker, as the
// picker's tree: [code, description, pickable, children]. Built once from the tariff's commodities
// report CSV (uk-tariff-2021-01-01--v4.0.1632).
const file = new URL('../../data/uk-tariff-commodities.json', import.meta.url)

let json
let descriptions

// Kept as text so each request sends the file without serialising it again.
export function commodityTreeJson() {
  json ??= readFile(file, 'utf8').catch((error) => {
    json = undefined
    throw error
  })
  return json
}

// Each code's description, for pages that show a code without the picker.
export function commodityDescriptions() {
  descriptions ??= commodityTreeJson()
    .then((text) => {
      const byCode = new Map()
      const walk = (nodes) => {
        for (const [code, description, , children] of nodes) {
          if (code) byCode.set(code, description)
          walk(children)
        }
      }
      walk(JSON.parse(text))
      return byCode
    })
    .catch((error) => {
      descriptions = undefined
      throw error
    })
  return descriptions
}
