import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Back Link Component', () => {
  test('Should link back with its text', () => {
    const $ = renderComponent('back-link', { href: '/traces', text: 'CHEDs' })

    expect($('a').attr('href')).toBe('/traces')
    expect($('a').text()).toBe('CHEDs')
  })
})
