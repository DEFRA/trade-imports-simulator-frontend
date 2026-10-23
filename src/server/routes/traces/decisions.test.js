import { applyDecision } from './decisions.js'
import { scenarios } from '#/test-helpers/scenarios/index.js'

const liveHorses = scenarios[0].model

const passed = {
  DOCUMENTARY_CHECK: 'YES',
  DOCUMENTARY_CHECK_RESULT: 'SATISFACTORY',
  IDENTITY_CHECK: 'YES',
  IDENTITY_CHECK_RESULT: 'SATISFACTORY',
  PHYSICAL_CHECK: 'NO'
}

describe('#applyDecision', () => {
  test('Should validate with the checks and a free circulation conclusion', () => {
    const decided = applyDecision(liveHorses, {
      status: 'VALIDATED',
      ...passed
    })

    expect(decided.status).toBe('VALIDATED')
    expect(decided.exchangedDocument.clearance.includedClause).toEqual({
      ...passed,
      DECISION_CONCLUSION: 'ACCEPTABLE_FOR_FREE_CIRCULATION'
    })
  })

  test('Should reject, keeping a refusal reason the CHED already has', () => {
    const model = structuredClone(liveHorses)
    model.exchangedDocument.includedNote.REFUSAL_REASON = 'MISSING_CERTIFICATE'

    const decided = applyDecision(model, {
      status: 'REJECTED',
      IDENTITY_CHECK: 'YES',
      IDENTITY_CHECK_RESULT: 'NOT_SATISFACTORY'
    })

    expect(decided.status).toBe('REJECTED')
    expect(
      decided.exchangedDocument.clearance.includedClause.DECISION_CONCLUSION
    ).toBe('NOT_ACCEPTABLE')
    expect(decided.exchangedDocument.includedNote.REFUSAL_REASON).toBe(
      'MISSING_CERTIFICATE'
    )
  })

  test('Should clear the refusal reason of a CHED no longer rejected', () => {
    const model = structuredClone(liveHorses)
    model.exchangedDocument.includedNote.REFUSAL_REASON = 'MISSING_CERTIFICATE'

    const decided = applyDecision(model, { status: 'VALIDATED' })

    expect(decided.exchangedDocument.includedNote).toEqual({ CHED_TYPE: 'A' })
  })

  test('Should save checks in progress without a conclusion, leaving out blanks', () => {
    const decided = applyDecision(liveHorses, {
      status: 'IN_PROGRESS',
      DOCUMENTARY_CHECK: 'YES',
      DOCUMENTARY_CHECK_RESULT: ''
    })

    expect(decided.status).toBe('IN_PROGRESS')
    expect(decided.exchangedDocument.clearance.includedClause).toEqual({
      DOCUMENTARY_CHECK: 'YES'
    })
  })

  test('Should replace the earlier decision but keep clauses the page does not set', () => {
    const rejected = applyDecision(liveHorses, {
      status: 'REJECTED',
      PHYSICAL_CHECK: 'YES',
      PHYSICAL_CHECK_RESULT: 'NOT_SATISFACTORY'
    })
    rejected.exchangedDocument.clearance.includedClause.WELFARE_CHECK = 'YES'

    const inProgress = applyDecision(rejected, { status: 'IN_PROGRESS' })

    expect(inProgress.exchangedDocument.clearance.includedClause).toEqual({
      WELFARE_CHECK: 'YES'
    })
    expect(inProgress.exchangedDocument.includedNote).toEqual({
      CHED_TYPE: 'A'
    })
  })

  test('Should keep the declaration and consignment', () => {
    const decided = applyDecision(liveHorses, { status: 'VALIDATED' })

    expect(decided.exchangedDocument.declaration).toEqual(
      liveHorses.exchangedDocument.declaration
    )
    expect(decided.specifiedConsignment).toEqual(
      liveHorses.specifiedConsignment
    )
  })
})
