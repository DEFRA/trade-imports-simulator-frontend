// A decision, as the stub's TestKit makes one (AuthenticationBuilder.Acceptable / NotAcceptable):
// a status, the decision conclusion, and the three checks with their results.
const checks = ['DOCUMENTARY_CHECK', 'IDENTITY_CHECK', 'PHYSICAL_CHECK']

function clearance(conclusion, result) {
  return {
    includedClause: Object.fromEntries([
      ['DECISION_CONCLUSION', conclusion],
      ...checks.flatMap((check) => [
        [check, 'YES'],
        [`${check}_RESULT`, result]
      ])
    ])
  }
}

const decisions = {
  accept: {
    status: 'VALIDATED',
    clearance: clearance('ACCEPTABLE_FOR_FREE_CIRCULATION', 'SATISFACTORY')
  },
  reject: {
    status: 'REJECTED',
    clearance: clearance('NOT_ACCEPTABLE', 'NOT_SATISFACTORY')
  }
}

// Applies a decision to the whole model, which is then PUT back. A PATCH would be shorter, but it
// can't clear a field, so accepting a CHED rejected earlier would keep the old refusal reason.
export function applyDecision(model, { decision, refusalReason }) {
  const { status, clearance } = decisions[decision]
  const decided = structuredClone(model)
  const document = (decided.exchangedDocument ??= {})
  const notes = (document.includedNote ??= {})

  decided.status = status
  document.clearance = clearance
  delete notes.REFUSAL_REASON
  if (decision === 'reject' && refusalReason) {
    notes.REFUSAL_REASON = refusalReason
  }
  return decided
}
