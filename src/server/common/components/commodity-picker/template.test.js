import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Commodity Picker Component', () => {
  test('Should label the slot the autocomplete input is rendered into', () => {
    const $ = renderComponent('commodity-picker', {
      id: 'line-__INDEX__-cnCode',
      name: 'cnCode',
      label: { text: 'CN code', classes: 'app-visually-hidden' }
    })

    expect($('label').attr('for')).toBe('line-__INDEX__-cnCode')
    expect($('label').hasClass('app-visually-hidden')).toBe(true)
    expect($('[data-commodity-picker-input]').attr('data-id')).toBe(
      'line-__INDEX__-cnCode'
    )
  })

  test('Should keep the value and attributes on the hidden input', () => {
    const $ = renderComponent('commodity-picker', {
      name: 'cnCode',
      value: '010410',
      attributes: { 'data-line-field': 'cnCode' }
    })

    const hidden = $('input[type="hidden"]')
    expect(hidden.attr('name')).toBe('cnCode')
    expect(hidden.val()).toBe('010410')
    expect(hidden.attr('data-line-field')).toBe('cnCode')
    expect($('[data-commodity-picker-input]').attr('data-id')).toBe('cnCode')
  })

  test('Should render Browse disabled until the tree loads', () => {
    const $ = renderComponent('commodity-picker', { name: 'cnCode' })

    const browse = $('[data-commodity-picker-browse]')
    expect(browse.attr('type')).toBe('button')
    expect(browse.prop('disabled')).toBe(true)
  })
})
