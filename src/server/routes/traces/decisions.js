// The clearance clauses the decision page sets, named as trade-traces-poc's ChedDecisionClause
// names them, with the codes each takes.
const performed = ['YES', 'NO']
const result = ['SATISFACTORY', 'NOT_SATISFACTORY']

export const checkClauses = {
  DOCUMENTARY_CHECK: performed,
  DOCUMENTARY_CHECK_RESULT: result,
  DOCUMENTARY_CHECK_RESULT_NATIONAL: result,
  IDENTITY_CHECK: performed,
  IDENTITY_CHECK_RESULT: result,
  PHYSICAL_CHECK: performed,
  PHYSICAL_CHECK_RESULT: result
}

// An in-progress CHED has no conclusion yet.
const conclusions = {
  VALIDATED: 'ACCEPTABLE_FOR_FREE_CIRCULATION',
  REJECTED: 'NOT_ACCEPTABLE'
}

export const decisionStatuses = ['IN_PROGRESS', 'VALIDATED', 'REJECTED']

// Applies a decision to the whole model, which is then PUT back. A PATCH would be shorter, but it
// can't clear a field, so accepting a CHED rejected earlier would keep its refusal reason.
// Clauses this page doesn't set, such as a CHED-A's welfare check, are kept.
export function applyDecision(model, { status, ...checks }) {
  const decided = structuredClone(model)
  const document = (decided.exchangedDocument ??= {})
  const notes = (document.includedNote ??= {})
  const clauses = { ...document.clearance?.includedClause }

  for (const clause of [...Object.keys(checkClauses), 'DECISION_CONCLUSION']) {
    delete clauses[clause]
  }
  for (const [clause, code] of Object.entries(checks)) {
    if (code) clauses[clause] = code
  }
  if (conclusions[status]) {
    clauses.DECISION_CONCLUSION = conclusions[status]
  }

  decided.status = status
  document.clearance = { ...document.clearance, includedClause: clauses }
  if (status !== 'REJECTED') {
    delete notes.REFUSAL_REASON
  }
  return decided
}
