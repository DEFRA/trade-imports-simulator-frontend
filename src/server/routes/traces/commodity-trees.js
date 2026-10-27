import { getCommodityTree } from '#/server/common/clients/certificate-control.js'
import { ControlApiError } from '#/server/common/clients/json-api.js'
import { getReferenceData } from '#/server/common/services/reference-data.js'

// A CHED type's commodity tree, trimmed for the browser's commodity picker. Each node is
// [code, description, pickable, children]: labels have no code, and a node is pickable when TRACES
// marks it selectable or it's a coded leaf (the CHED-D tree marks nothing selectable). CHED-D drops
// from about 1 MB to 300 KB, before compression.
const lifetime = 5 * 60 * 1000
const cache = new Map()

function trim(nodes = []) {
  return nodes.map((node) => {
    const code = node.item?.value ?? null
    const children = trim(node.node ?? [])
    const pickable = Boolean(
      code && (node.allowedForSelection || !children.length)
    )
    return [code, node.description?.value ?? '', pickable ? 1 : 0, children]
  })
}

async function load(chedType) {
  try {
    return trim((await getCommodityTree(chedType)).nodes)
  } catch (error) {
    if (!(error instanceof ControlApiError) || error.status !== 404) throw error
    // No tree for the type: the seeded CN codes, flat, so the picker always gets one shape.
    const { cnCodes } = await getReferenceData()
    return cnCodes.map(({ code, name }) => [code, name, 1, []])
  }
}

export async function trimmedTree(chedType) {
  const cached = cache.get(chedType)
  if (cached && Date.now() - cached.at < lifetime) return cached.tree

  const tree = await load(chedType)
  cache.set(chedType, { tree, at: Date.now() })
  return tree
}

export function clearTreeCache() {
  cache.clear()
}
