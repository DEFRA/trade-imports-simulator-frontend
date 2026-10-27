import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { mockSimulator } from '#/test-helpers/simulator.js'
import { clearTreeCache } from './commodity-trees.js'

// A cut of the stub's CHED-A tree, in the shape TRACES publishes: a chapter, a selectable code, a
// heading TRACES doesn't mark selectable with two leaves, and a label grouping a leaf.
const tree = [
  {
    item: { value: '01' },
    description: { value: 'LIVE ANIMALS' },
    allowedForSelection: false,
    node: [
      {
        item: { value: '0101' },
        description: { value: 'Live horses, asses, mules and hinnies' },
        allowedForSelection: true
      },
      {
        item: { value: '0104' },
        description: { value: 'Live sheep and goats' },
        allowedForSelection: false,
        node: [
          {
            item: { value: '010410' },
            description: { value: 'Sheep' },
            allowedForSelection: false
          },
          {
            item: { value: '010420' },
            description: { value: 'Goats' },
            allowedForSelection: true
          }
        ]
      },
      {
        description: { value: 'Cats, Dogs and ferrets.' },
        type: 1,
        node: [
          {
            item: { value: '01061900' },
            description: { value: 'Other' },
            allowedForSelection: true
          }
        ]
      }
    ]
  }
]

describe('GET /traces/api/commodity-trees/{chedType}', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    clearTreeCache()
  })

  const get = (chedType) =>
    server.inject({
      method: 'GET',
      url: `/traces/api/commodity-trees/${chedType}`
    })

  test('Should trim the tree to code, description, pickable and children', async () => {
    mockSimulator({ trees: { A: tree } })

    const { statusCode, result, headers } = await get('A')

    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['cache-control']).toBe('private, max-age=300')
    expect(result).toEqual([
      [
        '01',
        'LIVE ANIMALS',
        0,
        [
          ['0101', 'Live horses, asses, mules and hinnies', 1, []],
          // The heading isn't pickable; its leaves are, selectable or not, as in the CHED-D tree.
          [
            '0104',
            'Live sheep and goats',
            0,
            [
              ['010410', 'Sheep', 1, []],
              ['010420', 'Goats', 1, []]
            ]
          ],
          [null, 'Cats, Dogs and ferrets.', 0, [['01061900', 'Other', 1, []]]]
        ]
      ]
    ])
  })

  test('Should fall back to the seeded CN codes when the stub has no tree for the type', async () => {
    mockSimulator()

    const { statusCode, result } = await get('P')

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual([
      ['0101', 'Live horses, asses, mules and hinnies', 1, []]
    ])
  })

  test('Should read each tree from the stub once', async () => {
    mockSimulator({ trees: { A: tree } })

    await get('A')
    const calls = fetch.mock.calls.length
    await get('A')

    expect(fetch.mock.calls).toHaveLength(calls)
  })

  test('Should refuse a type with no tree in TRACES', async () => {
    const { statusCode } = await get('INTRA')

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
