import { fromModel, quantityOf, toModel } from './ched-model.js'
import { scenarios } from '#/test-helpers/scenarios/index.js'

const scenario = (id) => scenarios.find((s) => s.id === id).model
const liveHorses = scenario('ched-a-live-horses')
const milk = scenario('ched-p-milk')

describe('#quantityOf', () => {
  test('Should count CHED-A animals, in units only', () => {
    expect(quantityOf(liveHorses)).toMatchObject({
      heading: 'Volume',
      measure: 'netVolume',
      units: [{ code: 'H87', text: 'Unit' }],
      defaultUnit: 'H87'
    })
  })

  test('Should weigh everything else, in G, KG or Tonne, KG by default', () => {
    expect(quantityOf(milk)).toMatchObject({
      heading: 'Weight',
      measure: 'netWeight',
      defaultUnit: 'KGM'
    })
    expect(quantityOf(milk).units.map((unit) => unit.text)).toEqual([
      'G',
      'KG',
      'Tonne'
    ])
  })
})

describe('#fromModel', () => {
  test('Should flatten a scenario into form values', () => {
    expect(fromModel(liveHorses)).toEqual({
      purpose: 'FREE_CIRCULATION',
      goodsCertifiedAs: 'FATTENING',
      bcp: 'GBBEL',
      consignor: '770198',
      consignee: '899361',
      exportCountry: 'AF',
      importCountry: 'XI',
      lines: [
        {
          cnCode: '0101',
          originCountry: 'AF',
          quantity: '2',
          unit: 'H87'
        }
      ]
    })
  })

  test('Should show a weight in the unit it was stored in', () => {
    const model = structuredClone(milk)
    model.specifiedConsignment.includedConsignmentItem.includedTradeLineItem[0].netWeight =
      { value: 1.2, unitCode: 'TNE' }

    expect(fromModel(model).lines[0]).toMatchObject({
      quantity: '1.2',
      unit: 'TNE'
    })
  })
})

describe('#toModel', () => {
  test('Should keep the arrival time, which the form does not show', () => {
    const model = structuredClone(milk)
    model.specifiedConsignment.availabilityDueDateTime =
      '2026-10-16T09:30:45+00:00'

    expect(
      toModel(model, fromModel(model)).specifiedConsignment
        .availabilityDueDateTime
    ).toBe('2026-10-16T09:30:45+00:00')
  })

  test.each(scenarios.map(({ id, model }) => [id, model]))(
    'Should return %s unchanged when the form is unchanged',
    (_id, model) => {
      expect(toModel(model, fromModel(model))).toEqual(model)
    }
  )

  test('Should keep fields the form does not show', () => {
    const values = { ...fromModel(liveHorses), consignor: '883977' }

    const model = toModel(liveHorses, values)

    expect(model.specifiedConsignment.consignorParty.identifier).toBe('883977')
    expect(
      model.specifiedConsignment.includedConsignmentItem.natureIdCargo
    ).toBe('12')
  })

  test('Should place the parties and border control post by the export and import countries', () => {
    const values = {
      ...fromModel({}),
      exportCountry: 'FR',
      importCountry: 'GB',
      lines: []
    }

    const { specifiedConsignment } = toModel({}, values)

    expect(specifiedConsignment.consignorParty.postalAddress.countryId).toBe(
      'FR'
    )
    expect(specifiedConsignment.consigneeParty.postalAddress.countryId).toBe(
      'GB'
    )
    expect(specifiedConsignment.unloadingBaseportLocation.countryId).toBe('GB')
  })

  test('Should remove a field the form clears', () => {
    const values = { ...fromModel(liveHorses), goodsCertifiedAs: '' }

    const model = toModel(liveHorses, values)

    expect(model.exchangedDocument.declaration.includedClause).toEqual({
      PURPOSE: 'FREE_CIRCULATION'
    })
  })

  test("Should write a CHED-A's quantity as a volume in units", () => {
    const values = fromModel(liveHorses)
    values.lines[0] = { ...values.lines[0], quantity: '5', unit: '' }

    const [line] = toModel(liveHorses, values).specifiedConsignment
      .includedConsignmentItem.includedTradeLineItem

    expect(line.netVolume).toEqual({ value: 5, unitCode: 'H87' })
    expect(line.netWeight).toBeUndefined()
  })

  test("Should write another type's quantity as a weight in the chosen unit", () => {
    const values = fromModel(milk)
    values.lines[0] = { ...values.lines[0], quantity: '1.5', unit: 'TNE' }

    const [line] = toModel(milk, values).specifiedConsignment
      .includedConsignmentItem.includedTradeLineItem

    expect(line.netWeight).toEqual({ value: 1.5, unitCode: 'TNE' })
  })

  test('Should keep the measure the form does not show', () => {
    const model = structuredClone(liveHorses)
    model.specifiedConsignment.includedConsignmentItem.includedTradeLineItem[0].netWeight =
      { value: 900, unitCode: 'KGM' }

    const [line] = toModel(model, fromModel(model)).specifiedConsignment
      .includedConsignmentItem.includedTradeLineItem

    expect(line.netWeight).toEqual({ value: 900, unitCode: 'KGM' })
  })

  test('Should add and drop lines', () => {
    const values = fromModel(liveHorses)
    values.lines = [
      {
        cnCode: '0102',
        originCountry: 'FR',
        quantity: '1',
        unit: 'H87'
      }
    ]

    const lines = toModel(liveHorses, values).specifiedConsignment
      .includedConsignmentItem.includedTradeLineItem

    expect(lines).toEqual([
      {
        applicableClassification: { CN: '0102' },
        originCountry: 'FR',
        netVolume: { value: 1, unitCode: 'H87' },
        physicalReferencedLogisticsPackage: { typeCode: 'BX', itemQuantity: 2 }
      }
    ])
  })

  test('Should keep the CHED type and status from the base model', () => {
    const base = { ...liveHorses, status: 'VALIDATED' }

    const model = toModel(base, fromModel(base))

    expect(model.status).toBe('VALIDATED')
    expect(model.exchangedDocument.includedNote.CHED_TYPE).toBe('A')
  })

  test('Should not change the base model', () => {
    const before = structuredClone(liveHorses)

    toModel(liveHorses, {
      ...fromModel(liveHorses),
      purpose: 'INTERNAL_MARKET'
    })

    expect(liveHorses).toEqual(before)
  })
})
