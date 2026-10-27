import { jsonIsland } from './json-island.js'

describe('#jsonIsland', () => {
  test('Should serialise the value so it parses back unchanged', () => {
    const value = { name: '</script><script>alert(1)</script>' }

    const island = jsonIsland(value).toString()

    expect(island).not.toContain('<')
    expect(JSON.parse(island)).toEqual(value)
  })
})
