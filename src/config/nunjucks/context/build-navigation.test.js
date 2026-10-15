import { buildNavigation } from './build-navigation.js'

describe('#buildNavigation', () => {
  test('Should list every simulator, linking only those that are built', () => {
    expect(buildNavigation({ path: '/' })).toEqual([
      { text: 'TRACES', href: '/traces', current: false },
      { text: 'IPAFFS' },
      { text: 'CDS' }
    ])
  })

  test('Should mark TRACES current on its pages', () => {
    expect(buildNavigation({ path: '/traces' })[0].current).toBe(true)
  })
})
