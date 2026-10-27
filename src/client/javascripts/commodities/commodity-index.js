// Searching a commodity tree, as GET /traces/api/commodity-trees/{chedType} returns it: nodes of
// [code, description, pickable, children], where labels (group headings) have no code.

// Every coded node, in tree order, with the descriptions above it. Labels have no code, so they
// aren't entries, but they stay in the path: "Weighing not more than 185 g" tells two "Ducks" apart.
export function flatten(tree, path = [], entries = []) {
  for (const [code, description, pickable, children] of tree) {
    if (code) {
      entries.push({ code, description, path, pickable: Boolean(pickable) })
    }
    flatten(children, [...path, description], entries)
  }
  return entries
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// An entry's text lower-cased, worked out once: the UK tariff has about 17,000 entries to search
// on every keystroke.
const lowered = new WeakMap()

function textOf(entry) {
  let text = lowered.get(entry)
  if (!text) {
    text = {
      description: entry.description.toLowerCase(),
      path: entry.path.join(' ').toLowerCase()
    }
    lowered.set(entry, text)
  }
  return text
}

// How well one word matches an entry, best first: the start of a word in the description, inside
// the description, the start of a word in the path, inside the path. Undefined means no match.
function wordRank({ word, wordStart }, { description, path }) {
  if (wordStart.test(description)) return 0
  if (description.includes(word)) return 1
  if (wordStart.test(path)) return 2
  if (path.includes(word)) return 3
  return undefined
}

// Pickable entries matching the query. Digits match the start of a code, the exact code first.
// Anything else is words, each of which must appear in the description or the path. Ties keep
// tree order, which is code order.
export function search(entries, query, limit = 20) {
  const text = query.trim().toLowerCase()
  if (!text) return []

  if (/^\d+$/.test(text)) {
    const matches = entries.filter(
      (entry) => entry.pickable && entry.code.startsWith(text)
    )
    const exact = matches.filter((entry) => entry.code === text)
    const rest = matches.filter((entry) => entry.code !== text)
    return [...exact, ...rest].slice(0, limit)
  }

  const words = text.split(/\s+/).map((word) => ({
    word,
    wordStart: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}`, 'u')
  }))
  const ranked = []
  for (const entry of entries) {
    if (!entry.pickable) continue
    const entryText = textOf(entry)
    let rank = 0
    for (const word of words) {
      const wordScore = wordRank(word, entryText)
      if (wordScore === undefined) {
        rank = undefined
        break
      }
      rank += wordScore
    }
    if (rank !== undefined) ranked.push({ entry, rank })
  }

  // Array sort is stable, so equal ranks stay in tree order.
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ entry }) => entry)
}
