import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Sub Navigation Component', () => {
  test('Should mark the active item as the current page', () => {
    const $ = renderComponent('sub-navigation', {
      label: 'CHED parts',
      items: [
        { text: 'Part I', href: '/a', active: true },
        { text: 'Part II', href: '/b' }
      ]
    })

    expect($('nav').attr('aria-label')).toBe('CHED parts')
    expect($('a[aria-current="page"]').text()).toBe('Part I')
    expect($('a').last().attr('href')).toBe('/b')
  })
})
