// Commodity trees by URL, fetched once a page. The promise is cached, so lines added while the tree
// is still loading share the one request. A failed load is forgotten, to try again later.
const trees = new Map()

export function loadTree(url) {
  if (!trees.has(url)) {
    const tree = fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`${url}: ${response.status}`)
      }
      return response.json()
    })
    tree.catch(() => trees.delete(url))
    trees.set(url, tree)
  }
  return trees.get(url)
}
