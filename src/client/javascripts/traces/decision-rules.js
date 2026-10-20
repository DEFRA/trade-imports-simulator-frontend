// The decision page's checks (TRACES II.3 to II.5), as clearance clauses. Each check passes or fails
// on its first result; the documentary check's national result is optional.
export const checks = [
  {
    performed: 'DOCUMENTARY_CHECK',
    results: ['DOCUMENTARY_CHECK_RESULT', 'DOCUMENTARY_CHECK_RESULT_NATIONAL']
  },
  { performed: 'IDENTITY_CHECK', results: ['IDENTITY_CHECK_RESULT'] },
  { performed: 'PHYSICAL_CHECK', results: ['PHYSICAL_CHECK_RESULT'] }
]

const allResults = checks.flatMap(({ results }) => results)

// The status the checks add up to: any failed result rejects, every check passed or not carried
// out validates, anything else is still in progress.
export function deriveStatus(clauses) {
  if (allResults.some((result) => clauses[result] === 'NOT_SATISFACTORY')) {
    return 'REJECTED'
  }
  const complete = checks.every(
    ({ performed, results: [result] }) =>
      clauses[performed] === 'NO' ||
      (clauses[performed] === 'YES' && clauses[result] === 'SATISFACTORY')
  )
  return complete ? 'VALIDATED' : 'IN_PROGRESS'
}

// The checks to match a status chosen before them, so deriveStatus gives that status back.
// Validating passes every check carried out; rejecting with nothing failed yet fails them all, as
// the stub's TestKit does for NotAcceptable.
export function checksFor(status, clauses) {
  const filled = { ...clauses }

  if (status === 'VALIDATED') {
    for (const { performed, results } of checks) {
      if (filled[performed] === 'NO') continue
      filled[performed] = 'YES'
      for (const [index, result] of results.entries()) {
        if (index === 0 || filled[result] === 'NOT_SATISFACTORY') {
          filled[result] = 'SATISFACTORY'
        }
      }
    }
  }

  if (status === 'REJECTED' && deriveStatus(filled) !== 'REJECTED') {
    for (const { performed, results } of checks) {
      filled[performed] = 'YES'
      filled[results[0]] = 'NOT_SATISFACTORY'
    }
  }
  return filled
}
