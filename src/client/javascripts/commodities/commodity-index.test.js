import { flatten, search } from './commodity-index.js'

const tree = [
  [
    '01',
    'LIVE ANIMALS',
    0,
    [
      ['0101', 'Live horses, asses, mules and hinnies', 1, []],
      [
        '0104',
        'Live sheep and goats',
        0,
        [
          ['010410', 'Sheep', 1, []],
          ['010420', 'Goats', 1, []]
        ]
      ],
      [
        '0105',
        'Live poultry',
        0,
        [
          [
            null,
            'Weighing not more than 185 g',
            0,
            [['01051300', 'Ducks', 1, []]]
          ]
        ]
      ]
    ]
  ],
  [
    '03',
    'FISH',
    0,
    [
      ['0301', 'Shellfish', 1, []],
      ['0302', 'Live fish', 1, []]
    ]
  ]
]

const entries = flatten(tree)
const codes = (results) => results.map((entry) => entry.code)

describe('flatten', () => {
  test('Should list coded nodes in tree order, with labels kept in the path', () => {
    expect(codes(entries)).toEqual([
      '01',
      '0101',
      '0104',
      '010410',
      '010420',
      '0105',
      '01051300',
      '03',
      '0301',
      '0302'
    ])
    expect(entries.find((entry) => entry.code === '01051300')).toEqual({
      code: '01051300',
      description: 'Ducks',
      path: ['LIVE ANIMALS', 'Live poultry', 'Weighing not more than 185 g'],
      pickable: true
    })
  })
})

describe('search', () => {
  test('Should match a code prefix with pickable entries only', () => {
    expect(codes(search(entries, '0104'))).toEqual(['010410', '010420'])
    expect(codes(search(entries, '01'))).not.toContain('01')
  })

  test('Should put the exact code first', () => {
    const exactTree = [
      ['0101', 'Horses', 1, [['010121', 'Pure-bred breeding horses', 1, []]]]
    ]
    expect(codes(search(flatten(exactTree), '0101'))).toEqual([
      '0101',
      '010121'
    ])
    expect(codes(search(flatten(exactTree), '010121'))).toEqual(['010121'])
  })

  test('Should need every word of a text query, in any case', () => {
    expect(codes(search(entries, 'HORSES live'))).toEqual(['0101'])
    expect(codes(search(entries, 'live cats'))).toEqual([])
  })

  test('Should match a word from the path', () => {
    expect(codes(search(entries, 'poultry'))).toEqual(['01051300'])
    expect(codes(search(entries, 'goats'))).toEqual(['010420', '010410'])
  })

  test('Should rank word-start matches above substring matches', () => {
    expect(codes(search(entries, 'fish'))).toEqual(['0302', '0301'])
  })

  test('Should return only pickable entries', () => {
    expect(codes(search(entries, 'fish'))).not.toContain('03')
    expect(codes(search(entries, 'sheep'))).toEqual(['010410', '010420'])
    expect(codes(search(entries, 'animals'))).toEqual([
      '0101',
      '010410',
      '010420',
      '01051300'
    ])
  })

  test('Should stop at the limit', () => {
    expect(search(entries, '0', 3)).toHaveLength(3)
    expect(search(entries, '0')).toHaveLength(6)
  })

  test('Should find nothing for a blank query', () => {
    expect(search(entries, '  ')).toEqual([])
  })
})
