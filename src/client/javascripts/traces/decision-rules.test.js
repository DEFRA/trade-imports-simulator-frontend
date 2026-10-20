import { checksFor, deriveStatus } from './decision-rules.js'

const passed = {
  DOCUMENTARY_CHECK: 'YES',
  DOCUMENTARY_CHECK_RESULT: 'SATISFACTORY',
  IDENTITY_CHECK: 'YES',
  IDENTITY_CHECK_RESULT: 'SATISFACTORY',
  PHYSICAL_CHECK: 'NO'
}

describe('#deriveStatus', () => {
  test('Should validate when every check passed or was not carried out', () => {
    expect(deriveStatus(passed)).toBe('VALIDATED')
  })

  test('Should reject on any failed result, the national one included', () => {
    expect(
      deriveStatus({
        ...passed,
        DOCUMENTARY_CHECK_RESULT_NATIONAL: 'NOT_SATISFACTORY'
      })
    ).toBe('REJECTED')
  })

  test('Should be in progress while a check is unanswered', () => {
    expect(deriveStatus({ ...passed, PHYSICAL_CHECK: '' })).toBe('IN_PROGRESS')
    expect(deriveStatus({})).toBe('IN_PROGRESS')
  })

  test('Should be in progress while a check carried out has no result', () => {
    expect(deriveStatus({ ...passed, IDENTITY_CHECK_RESULT: '' })).toBe(
      'IN_PROGRESS'
    )
  })
})

describe('#checksFor', () => {
  test('Should pass every check when validating from nothing', () => {
    expect(checksFor('VALIDATED', {})).toEqual({
      DOCUMENTARY_CHECK: 'YES',
      DOCUMENTARY_CHECK_RESULT: 'SATISFACTORY',
      IDENTITY_CHECK: 'YES',
      IDENTITY_CHECK_RESULT: 'SATISFACTORY',
      PHYSICAL_CHECK: 'YES',
      PHYSICAL_CHECK_RESULT: 'SATISFACTORY'
    })
  })

  test('Should keep a check not carried out, and fix a failed national result, when validating', () => {
    const filled = checksFor('VALIDATED', {
      ...passed,
      DOCUMENTARY_CHECK_RESULT_NATIONAL: 'NOT_SATISFACTORY'
    })

    expect(filled.PHYSICAL_CHECK).toBe('NO')
    expect(filled.DOCUMENTARY_CHECK_RESULT_NATIONAL).toBe('SATISFACTORY')
    expect(deriveStatus(filled)).toBe('VALIDATED')
  })

  test('Should fail every check when rejecting with nothing failed', () => {
    const filled = checksFor('REJECTED', passed)

    expect(filled).toMatchObject({
      DOCUMENTARY_CHECK_RESULT: 'NOT_SATISFACTORY',
      IDENTITY_CHECK_RESULT: 'NOT_SATISFACTORY',
      PHYSICAL_CHECK: 'YES',
      PHYSICAL_CHECK_RESULT: 'NOT_SATISFACTORY'
    })
  })

  test('Should leave the checks alone when rejecting with a failure already', () => {
    const failed = { ...passed, IDENTITY_CHECK_RESULT: 'NOT_SATISFACTORY' }

    expect(checksFor('REJECTED', failed)).toEqual(failed)
  })

  test('Should leave the checks alone when in progress', () => {
    expect(checksFor('IN_PROGRESS', passed)).toEqual(passed)
  })
})
