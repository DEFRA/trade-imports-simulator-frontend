import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Pagination Component', () => {
  test('Should link the previous, next and numbered pages', () => {
    const $ = renderComponent('pagination', {
      previous: { href: '/a?page=1' },
      next: { href: '/a?page=3' },
      items: [
        { number: 1, href: '/a?page=1' },
        { ellipsis: true },
        { number: 2, href: '/a?page=2', current: true },
        { number: 3, href: '/a?page=3' }
      ]
    })

    expect($('a[rel="prev"]').attr('href')).toBe('/a?page=1')
    expect($('a[rel="next"]').attr('href')).toBe('/a?page=3')
    expect($('a[aria-current="page"]').text()).toBe('2')
    expect($('.app-pagination__ellipsis')).toHaveLength(1)
  })

  test('Should leave out the links it is not given', () => {
    const $ = renderComponent('pagination', {
      next: { href: '/a?page=2' },
      items: [{ number: 1, href: '/a?page=1', current: true }]
    })

    expect($('a[rel="prev"]')).toHaveLength(0)
    expect($('a[rel="next"]').text()).toContain('Next')
  })
})
