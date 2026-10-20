import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Radios Component', () => {
  const params = {
    name: 'IDENTITY_CHECK',
    fieldset: { legend: { text: 'Carried out' } },
    items: [
      { value: 'YES', text: 'Yes' },
      { value: 'NO', text: 'No' }
    ]
  }

  test('Should check the item matching value', () => {
    const $ = renderComponent('radios', { ...params, value: 'NO' })

    expect($('legend').text()).toBe('Carried out')
    expect($('input:checked').val()).toBe('NO')
    expect(
      $('input')
        .map((_, input) => $(input).attr('id'))
        .get()
    ).toEqual(['IDENTITY_CHECK', 'IDENTITY_CHECK-2'])
  })

  test('Should check nothing without a value', () => {
    const $ = renderComponent('radios', params)

    expect($('input:checked')).toHaveLength(0)
  })
})
