import { fromModel, toModel } from './ched-model.js'
import { scenarios } from '#/server/routes/traces/scenarios/index.js'

const liveHorses = scenarios[0].model

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
          netWeight: '900',
          pieces: '',
          packages: '2',
          packageType: 'BX'
        }
      ]
    })
  })

  test('Should show other mass units in kilograms', () => {
    const model = {
      specifiedConsignment: {
        includedConsignmentItem: {
          includedTradeLineItem: [{ netWeight: { value: 2, unitCode: 'TNE' } }]
        }
      }
    }

    expect(fromModel(model).lines[0].netWeight).toBe('2000')
  })
})

describe('#toModel', () => {
  test('Should return the base model unchanged when the form is unchanged', () => {
    expect(toModel(liveHorses, fromModel(liveHorses))).toEqual(liveHorses)
  })

  test('Should keep fields the form does not show', () => {
    const values = { ...fromModel(liveHorses), consignor: '883977' }

    const model = toModel(liveHorses, values)

    expect(model.specifiedConsignment.consignorParty).toEqual({
      identifier: '883977',
      postalAddress: { countryId: 'XI' }
    })
    expect(
      model.specifiedConsignment.includedConsignmentItem.natureIdCargo
    ).toBe('12')
  })

  test('Should remove a field the form clears', () => {
    const values = { ...fromModel(liveHorses), goodsCertifiedAs: '' }

    const model = toModel(liveHorses, values)

    expect(model.exchangedDocument.declaration.includedClause).toEqual({
      PURPOSE: 'FREE_CIRCULATION'
    })
  })

  test('Should switch a line from weight to head count', () => {
    const values = fromModel(liveHorses)
    values.lines[0] = {
      ...values.lines[0],
      netWeight: '',
      pieces: '3',
      packages: ''
    }

    const [line] = toModel(liveHorses, values).specifiedConsignment
      .includedConsignmentItem.includedTradeLineItem

    expect(line).toEqual({
      applicableClassification: { CN: '0101' },
      originCountry: 'AF',
      netVolume: { value: 3, unitCode: 'H87' }
    })
  })

  test('Should add and drop lines', () => {
    const values = fromModel(liveHorses)
    values.lines = [
      {
        cnCode: '0102',
        originCountry: 'FR',
        netWeight: '',
        pieces: '1',
        packages: '',
        packageType: ''
      }
    ]

    const lines = toModel(liveHorses, values).specifiedConsignment
      .includedConsignmentItem.includedTradeLineItem

    expect(lines).toHaveLength(1)
    expect(lines[0].applicableClassification.CN).toBe('0102')
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
