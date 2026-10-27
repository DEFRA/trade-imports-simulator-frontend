import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Button Component', () => {
  test('Should render a submit button carrying its name and value', () => {
    const $ = renderComponent('button', {
      text: 'Remove',
      name: 'removeLine',
      value: 0
    })

    expect($('button').attr('type')).toBe('submit')
    expect($('button').attr('name')).toBe('removeLine')
    expect($('button').attr('value')).toBe('0')
    expect($('button').text()).toBe('Remove')
  })

  test('Should render a link when given an href', () => {
    const $ = renderComponent('button', {
      text: 'View',
      href: '/x',
      classes: 'app-button--blue'
    })

    expect($('a').attr('href')).toBe('/x')
    expect($('a').attr('class')).toBe('app-button app-button--blue')
  })
})
