import { pagination } from './pagination.js'

const names = {
  path: '/cds',
  landmarkLabel: 'Declaration pages',
  newer: 'newer declarations',
  older: 'older declarations'
}

describe('#pagination', () => {
  test('Should have no links when everything fits on the first page', () => {
    expect(pagination(1, false, names)).toBeUndefined()
  })

  test('Should run from the first page to the one after this', () => {
    const { items, previous, next, landmarkLabel } = pagination(5, true, names)

    expect(items.map((item) => item.number ?? '…')).toEqual([1, '…', 4, 5, 6])
    expect(items.find((item) => item.current).number).toBe(5)
    expect(previous).toEqual({
      href: '/cds?page=4',
      labelText: 'newer declarations'
    })
    expect(next).toEqual({
      href: '/cds?page=6',
      labelText: 'older declarations'
    })
    expect(landmarkLabel).toBe('Declaration pages')
  })

  test('Should have no next link on the last page', () => {
    const { items, next } = pagination(2, false, names)

    expect(items.map((item) => item.number)).toEqual([1, 2])
    expect(next).toBeUndefined()
  })
})
