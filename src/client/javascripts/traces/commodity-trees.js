// Commodity trees by CHED type, fetched once a page. The promise is cached, so lines added while
// the tree is still loading share the one request. A failed load is forgotten, to try again later.
const trees = new Map()

export function loadTree(chedType) {
  if (!trees.has(chedType)) {
    const tree = fetch(
      `/traces/api/commodity-trees/${encodeURIComponent(chedType)}`
    ).then((response) => {
      if (!response.ok) {
        throw new Error(`Commodity tree ${chedType}: ${response.status}`)
      }
      return response.json()
    })
    tree.catch(() => trees.delete(chedType))
    trees.set(chedType, tree)
  }
  return trees.get(chedType)
}
