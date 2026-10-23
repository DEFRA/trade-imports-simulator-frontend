import { countries } from './countries.js'

describe('#countries', () => {
  const byCode = new Map(countries.map(({ code, name }) => [code, name]))

  test('Should name the ISO countries, plus Kosovo and Northern Ireland', () => {
    expect(countries).toHaveLength(251)
    expect(byCode.get('CN')).toBe('China')
    expect(byCode.get('GB')).toBe('United Kingdom')
    expect(byCode.get('XK')).toBe('Kosovo')
    expect(byCode.get('XI')).toBe('Northern Ireland')
  })

  test("Should leave out regions that aren't countries, and old codes", () => {
    for (const code of ['EU', 'UN', 'ZZ', 'XA', 'IC', 'UK', 'YU']) {
      expect(byCode.has(code)).toBe(false)
    }
  })

  test('Should sort by name', () => {
    const names = countries.map(({ name }) => name)
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, 'en-GB'))
    )
  })
})
