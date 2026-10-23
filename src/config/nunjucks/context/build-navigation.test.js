import { config } from '#/config/config.js'
import { buildNavigation } from './build-navigation.js'

describe('#buildNavigation', () => {
  afterEach(() => {
    config.set('tracesSimulator.enabled', true)
  })

  test('Should list every enabled simulator', () => {
    expect(buildNavigation({ path: '/' })).toEqual([
      { text: 'TRACES', href: '/traces', current: false },
      { text: 'CDS', href: '/cds', current: false }
    ])
  })

  test('Should leave out a disabled simulator', () => {
    config.set('tracesSimulator.enabled', false)

    expect(buildNavigation({ path: '/' })).toEqual([
      { text: 'CDS', href: '/cds', current: false }
    ])
  })

  test('Should mark TRACES current on its pages', () => {
    expect(buildNavigation({ path: '/traces' })[0].current).toBe(true)
  })

  test('Should mark CDS current on its pages', () => {
    expect(buildNavigation({ path: '/cds/declarations/new' })[1].current).toBe(
      true
    )
  })
})
