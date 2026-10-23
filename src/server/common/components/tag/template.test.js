import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Tag Component', () => {
  test('Should render its text with modifier classes', () => {
    const $ = renderComponent('tag', {
      text: 'VALIDATED',
      classes: 'app-tag--green'
    })

    expect($('strong').text()).toBe('VALIDATED')
    expect($('strong').attr('class')).toBe('app-tag app-tag--green')
  })
})
