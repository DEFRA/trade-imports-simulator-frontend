import {
  applyCombination,
  forAmend,
  forCreate,
  forScenario,
  followDispatch,
  fromModel,
  toLocalInput,
  toModel
} from './declaration-model.js'

const arrival = new Date(2026, 9, 22, 9, 30).getTime()

// A version as the simulator hands it back: with what it issued, and a document quantity the form
// doesn't show.
const stored = {
  serviceHeader: {
    sourceSystem: 'CDS',
    destinationSystem: 'ALVS',
    correlationId: '17925084515987626790',
    serviceCallTimestamp: 1792508451000
  },
  header: {
    entryReference: '26GB0P19E7LGB46A2V',
    entryVersionNumber: 1,
    declarationUCR: '1GB116445386000-KDA35932Y1BHX',
    declarationType: 'S',
    arrivalDateTime: arrival
  },
  items: [
    {
      itemNumber: 1,
      taricCommodityCode: '0201100021',
      goodsDescription: 'Of bison',
      itemNetMass: 5011.2,
      documents: [
        {
          documentCode: 'N853',
          documentReference: 'GBCHD2026.0000001',
          documentStatus: 'AE',
          documentControl: 'P',
          documentQuantity: 10
        }
      ],
      checks: [{ checkCode: 'H222', departmentCode: 'PHA' }]
    }
  ]
}

describe('#declarationModel', () => {
  test('Should read a request into the form, times as local input values', () => {
    const values = fromModel(stored)

    expect(values.declarationType).toBe('S')
    expect(values.arrivalDateTime).toBe('2026-10-22T09:30')
    expect(values.goodsLocationCode).toBe('')
    expect(values.items[0]).toMatchObject({
      taricCommodityCode: '0201100021',
      itemNetMass: '5011.2',
      documents: [
        { documentCode: 'N853', documentReference: 'GBCHD2026.0000001' }
      ]
    })
  })

  test('Should lay the form over the request, keeping what the form does not show', () => {
    const values = fromModel(stored)
    values.items[0].documents[0].documentReference = 'GBCHD2026.0000002'
    values.items[0].itemNetMass = '12'

    const model = toModel(stored, values)

    expect(model.items[0].documents[0]).toEqual({
      ...stored.items[0].documents[0],
      documentReference: 'GBCHD2026.0000002'
    })
    expect(model.items[0].itemNetMass).toBe(12)
    expect(model.items[0].checks).toEqual(stored.items[0].checks)
    expect(model.header.arrivalDateTime).toBe(arrival)
  })

  test('Should send the checks the form holds', () => {
    const values = fromModel(stored)
    values.items[0].checks.push({ checkCode: 'H224', departmentCode: 'PHA' })

    const model = toModel(stored, values)

    expect(model.items[0].checks).toEqual([
      { checkCode: 'H222', departmentCode: 'PHA' },
      { checkCode: 'H224', departmentCode: 'PHA' }
    ])
  })

  test('Should set an item to a combination, keeping the documents it already has', () => {
    const item = fromModel(stored).items[0]

    const lines = applyCombination(
      item,
      { checks: ['H222', 'H224'], documents: ['C673', 'N853'] },
      { H222: 'PHA', H224: 'PHA' }
    )

    expect(lines.checks).toEqual([
      { checkCode: 'H222', departmentCode: 'PHA' },
      { checkCode: 'H224', departmentCode: 'PHA' }
    ])
    expect(lines.documents).toEqual([
      {
        documentCode: 'C673',
        documentReference: '',
        documentStatus: 'AE',
        documentControl: 'P'
      },
      item.documents[0]
    ])
  })

  test('Should drop documents a combination does not have', () => {
    const item = fromModel(stored).items[0]

    const lines = applyCombination(
      item,
      { checks: ['H220'], documents: [] },
      { H220: 'HMI' }
    )

    expect(lines).toEqual({
      checks: [{ checkCode: 'H220', departmentCode: 'HMI' }],
      documents: []
    })
  })

  test('Should number items in the order the form shows them, and drop cleared fields', () => {
    const values = fromModel(stored)
    values.declarationType = ''
    values.items.unshift({
      ...values.items[0],
      taricCommodityCode: '0101210000',
      documents: []
    })

    const model = toModel(stored, values)

    expect(model.header).not.toHaveProperty('declarationType')
    expect(model.header.declarationUCR).toBe('1GB116445386000-KDA35932Y1BHX')
    expect(
      model.items.map((item) => [item.itemNumber, item.taricCommodityCode])
    ).toEqual([
      [1, '0101210000'],
      [2, '0201100021']
    ])
  })

  test('Should take the goods description from the commodity, keeping the old one without it', () => {
    const values = fromModel(stored)
    values.items.push({ ...values.items[0], goodsDescription: 'Live bison' })

    const model = toModel(stored, values)

    expect(model.items.map((item) => item.goodsDescription)).toEqual([
      'Of bison',
      'Live bison'
    ])
  })

  test('Should make the declarant its own name, the submitter and every item consignee', () => {
    const values = fromModel(stored)
    values.declarant = 'GB999000000042'
    values.items.push({ ...values.items[0] })

    const model = toModel(stored, values)

    expect(model.header).toMatchObject({
      declarantId: 'GB999000000042',
      declarantName: 'GB999000000042',
      submitterTURN: 'GB888000000042'
    })
    expect(model.header).not.toHaveProperty('declarant')
    expect(
      model.items.map((item) => [item.consigneeId, item.consigneeName])
    ).toEqual([
      ['GB999000000042', 'GB999000000042'],
      ['GB999000000042', 'GB999000000042']
    ])
  })

  test('Should send a new declaration without an MRN or anything the simulator issues', () => {
    const request = forCreate(stored)

    expect(request.header).not.toHaveProperty('entryReference')
    expect(request.header).not.toHaveProperty('entryVersionNumber')
    expect(request.serviceHeader).toEqual({
      sourceSystem: 'CDS',
      destinationSystem: 'ALVS'
    })
    expect(stored.header.entryReference).toBe('26GB0P19E7LGB46A2V')
  })

  test('Should send an amendment as the next version of the same MRN', () => {
    const request = forAmend(stored, '26GB0P19E7LGB46A2V', 3)

    expect(request.header).toMatchObject({
      entryReference: '26GB0P19E7LGB46A2V',
      entryVersionNumber: 4,
      previousVersionNumber: 3
    })
    expect(request.serviceHeader).not.toHaveProperty('correlationId')
    expect(request.serviceHeader).not.toHaveProperty('serviceCallTimestamp')
  })

  test('Should save a scenario without an MRN or an arrival time', () => {
    const scenario = forScenario(stored)

    expect(scenario.header).not.toHaveProperty('entryReference')
    expect(scenario.header).not.toHaveProperty('arrivalDateTime')
    expect(scenario.items).toEqual(stored.items)
  })

  test('Should move an origin with the dispatch country until it is set apart', () => {
    expect(followDispatch('', '', 'CN')).toBe('CN')
    expect(followDispatch('CN', 'CN', 'IN')).toBe('IN')
    expect(followDispatch('VN', 'CN', 'IN')).toBe('VN')
    expect(followDispatch('CN', 'CN', '')).toBe('')
  })

  test('Should leave an unset time empty', () => {
    expect(toLocalInput(undefined)).toBe('')
  })
})
