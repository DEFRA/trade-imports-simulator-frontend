import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Select Component', () => {
  test('Should select the item matching value', () => {
    const $ = renderComponent('select', {
      name: 'bcp',
      label: { text: 'Border control post' },
      value: 'GBLAR',
      items: [
        { value: 'GBBEL', text: 'Belfast' },
        { value: 'GBLAR', text: 'Larne' }
      ]
    })

    expect($('select').val()).toBe('GBLAR')
    expect($('option')).toHaveLength(2)
  })

  test('Should use the text as the value when an item has none', () => {
    const $ = renderComponent('select', {
      name: 'status',
      items: [{ text: 'NEW' }]
    })

    expect($('option').attr('value')).toBe('NEW')
  })
})
