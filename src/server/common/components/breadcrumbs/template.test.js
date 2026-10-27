import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Breadcrumbs Component', () => {
  test('Should link every item but the current page', () => {
    const $ = renderComponent('breadcrumbs', {
      items: [{ text: 'CHEDs', href: '/traces' }, { text: 'Create a CHED' }]
    })

    expect($('a').attr('href')).toBe('/traces')
    expect($('a').text()).toBe('CHEDs')
    expect($('[aria-current="page"]').text()).toBe('Create a CHED')
  })
})
