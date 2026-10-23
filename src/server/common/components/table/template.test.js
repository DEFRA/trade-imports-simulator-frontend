import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Table Component', () => {
  test('Should render head and rows, aligning numeric cells', () => {
    const $ = renderComponent('table', {
      head: [{ text: 'CN code' }, { text: 'Net weight', format: 'numeric' }],
      rows: [[{ text: '0101' }, { text: '900', format: 'numeric' }]]
    })

    expect($('thead th')).toHaveLength(2)
    expect($('tbody td').first().text()).toBe('0101')
    expect($('tbody td').last().hasClass('app-table__cell--numeric')).toBe(true)
  })
})
