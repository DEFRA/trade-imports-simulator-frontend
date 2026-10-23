import { readFile, writeFile } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'

// Builds src/server/data/uk-tariff-commodities.json, the declaration form's commodity picker tree,
// from the UK Trade Tariff's "commodities report" CSV download. The checked-in tree came from
// uk-tariff-2021-01-01--v4.0.1632. To update the codes, download a newer report and run:
//
//   node scripts/build-tariff.js path/to/commodities-report.csv
const output = new URL(
  '../src/server/data/uk-tariff-commodities.json',
  import.meta.url
)

// Descriptions carry the tariff's own markup: <br> and newlines between clauses, <sup>/<sub> in
// formulas and units, and | where it means a non-breaking space. The picker shows plain text.
function plain(description) {
  return description
    .replace(/<br\s*\/?>|\n|\|/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Builds the picker's tree, [code, description, pickable, children], from the CSV's rows, linked by
// SID. Only codes in force (no end date) are kept. A row is pickable when it can be declared: suffix
// 80 with no children. Rows with another suffix are headings that share a code with the declarable
// row below them, so they become labels (no code) to keep codes unique in the picker. A code the
// tariff re-issued appears twice in force; the newer row wins and takes the older one's children.
export function buildTree(csv) {
  const rows = parse(csv, { columns: true, skip_empty_lines: true }).filter(
    (row) => row.commodity__validity_end === '#NA'
  )

  const newest = new Map()
  for (const row of rows) {
    const key = `${row.commodity__code}-${row.commodity__suffix}`
    const kept = newest.get(key)
    if (
      !kept ||
      row.commodity__validity_start > kept.commodity__validity_start
    ) {
      newest.set(key, row)
    }
  }
  const sidOf = new Map(
    rows.map((row) => [
      row.commodity__sid,
      newest.get(`${row.commodity__code}-${row.commodity__suffix}`)
        .commodity__sid
    ])
  )

  const children = new Map()
  for (const row of newest.values()) {
    const parent = sidOf.get(row.parent__sid) ?? null
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(row)
  }

  const nodes = (parent) =>
    (children.get(parent) ?? []).map((row) => {
      const below = nodes(row.commodity__sid)
      const declarable = row.commodity__suffix === '80'
      return [
        declarable ? row.commodity__code : null,
        plain(row.commodity__description),
        declarable && !below.length ? 1 : 0,
        below
      ]
    })
  return nodes(null)
}

if (import.meta.main) {
  const [csvPath] = process.argv.slice(2)
  if (!csvPath) {
    console.error(
      'Usage: node scripts/build-tariff.js <commodities-report.csv>'
    )
    process.exit(1)
  }
  const tree = buildTree(await readFile(csvPath, 'utf8'))
  await writeFile(output, JSON.stringify(tree))
  console.log(`Wrote ${tree.length} chapters to ${output.pathname}`)
}
