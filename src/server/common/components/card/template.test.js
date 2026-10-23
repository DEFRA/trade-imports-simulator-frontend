import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Card Component', () => {
  test('Should render its title and call block', () => {
    const $ = renderComponent(
      'card',
      { title: { text: 'Result' } },
      '<p>Body</p>'
    )

    expect($('.app-card__title').text()).toBe('Result')
    expect($('.app-card p').text()).toBe('Body')
  })
})
