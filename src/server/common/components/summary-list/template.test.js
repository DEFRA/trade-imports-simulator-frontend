import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Summary List Component', () => {
  test('Should render each row, marking empty values', () => {
    const $ = renderComponent('summary-list', {
      rows: [
        { key: { text: 'Type' }, value: { text: 'CHED-A' } },
        { key: { text: 'Refusal reason' }, value: {} }
      ]
    })

    expect($('dt').first().text()).toBe('Type')
    expect($('dd').first().text()).toBe('CHED-A')
    expect($('dd').last().find('.app-empty')).toHaveLength(1)
  })
})
