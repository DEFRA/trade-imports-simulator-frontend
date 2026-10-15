import { applyDecision } from './decisions.js'
import { scenarios } from './scenarios/index.js'

const liveHorses = scenarios[0].model

describe('#applyDecision', () => {
  test('Should accept with every check satisfactory', () => {
    const decided = applyDecision(liveHorses, { decision: 'accept' })

    expect(decided.status).toBe('VALIDATED')
    expect(decided.exchangedDocument.clearance.includedClause).toEqual({
      DECISION_CONCLUSION: 'ACCEPTABLE_FOR_FREE_CIRCULATION',
      DOCUMENTARY_CHECK: 'YES',
      DOCUMENTARY_CHECK_RESULT: 'SATISFACTORY',
      IDENTITY_CHECK: 'YES',
      IDENTITY_CHECK_RESULT: 'SATISFACTORY',
      PHYSICAL_CHECK: 'YES',
      PHYSICAL_CHECK_RESULT: 'SATISFACTORY'
    })
  })

  test('Should reject with the refusal reason as a note', () => {
    const decided = applyDecision(liveHorses, {
      decision: 'reject',
      refusalReason: 'MISSING_CERTIFICATE'
    })

    expect(decided.status).toBe('REJECTED')
    expect(
      decided.exchangedDocument.clearance.includedClause.DECISION_CONCLUSION
    ).toBe('NOT_ACCEPTABLE')
    expect(decided.exchangedDocument.includedNote).toEqual({
      CHED_TYPE: 'A',
      REFUSAL_REASON: 'MISSING_CERTIFICATE'
    })
  })

  test('Should drop an earlier refusal reason when accepting', () => {
    const rejected = applyDecision(liveHorses, {
      decision: 'reject',
      refusalReason: 'MISSING_CERTIFICATE'
    })

    const accepted = applyDecision(rejected, { decision: 'accept' })

    expect(accepted.exchangedDocument.includedNote).toEqual({ CHED_TYPE: 'A' })
  })

  test('Should keep the declaration and consignment', () => {
    const decided = applyDecision(liveHorses, { decision: 'accept' })

    expect(decided.exchangedDocument.declaration).toEqual(
      liveHorses.exchangedDocument.declaration
    )
    expect(decided.specifiedConsignment).toEqual(
      liveHorses.specifiedConsignment
    )
  })
})
