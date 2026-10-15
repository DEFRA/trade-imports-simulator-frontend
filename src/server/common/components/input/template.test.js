import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Input Component', () => {
  test('Should label the input and keep its value', () => {
    const $ = renderComponent('input', {
      name: 'cnCode',
      value: '0101',
      label: { text: 'CN code' }
    })

    expect($('label').attr('for')).toBe('cnCode')
    expect($('input').attr('id')).toBe('cnCode')
    expect($('input').val()).toBe('0101')
  })

  test('Should describe the input by its hint and error', () => {
    const $ = renderComponent('input', {
      name: 'cnCode',
      label: { text: 'CN code' },
      hint: { text: 'Six or eight digits' },
      errorMessage: { text: 'Unknown CN code' }
    })

    expect($('input').attr('aria-describedby')).toBe('cnCode-hint cnCode-error')
    expect($('.app-field__error').text()).toBe('Unknown CN code')
    expect($('input').hasClass('app-input--error')).toBe(true)
  })
})
