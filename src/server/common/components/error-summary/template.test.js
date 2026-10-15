import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Error Summary Component', () => {
  test('Should link each error to its field', () => {
    const $ = renderComponent('error-summary', {
      titleText: 'The simulator rejected the CHED',
      errorList: [{ text: 'Unknown CN code', href: '#lines-0-cnCode' }]
    })

    expect($('.app-error-summary__title').text()).toBe(
      'The simulator rejected the CHED'
    )
    expect($('.app-error-summary__list a').attr('href')).toBe('#lines-0-cnCode')
  })
})
