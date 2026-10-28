import {
  SET_BY_SIMULATOR,
  describeNotificationMessage,
  notificationBody
} from './notification-request.js'

describe('#notificationBody', () => {
  test('Should send None as null', () => {
    expect(notificationBody({ iuuCheckOutcome: '' })).toEqual({
      iuuCheckOutcome: null
    })
  })

  test('Should send the IUU check outcome', () => {
    expect(notificationBody({ iuuCheckOutcome: 'IUUNA' })).toEqual({
      iuuCheckOutcome: 'IUUNA'
    })
  })
})

describe('#describeNotificationMessage', () => {
  test('Should show every field of the IuuNotification', () => {
    expect(
      JSON.parse(
        describeNotificationMessage({
          reference: ' IUU.GB.2026.0000001 ',
          iuuCheckOutcome: 'IUUNotCompliant'
        })
      )
    ).toEqual({
      reference: 'IUU.GB.2026.0000001',
      lastUpdated: SET_BY_SIMULATOR,
      iuuCheckOutcome: 'IUUNotCompliant'
    })
  })

  test('Should show None as a null outcome', () => {
    expect(
      JSON.parse(
        describeNotificationMessage({
          reference: 'IUU.GB.2026.0000001',
          iuuCheckOutcome: ''
        })
      )
    ).toEqual({
      reference: 'IUU.GB.2026.0000001',
      lastUpdated: SET_BY_SIMULATOR,
      iuuCheckOutcome: null
    })
  })

  test('Should show a placeholder until there is a reference', () => {
    const message = JSON.parse(
      describeNotificationMessage({ reference: ' ', iuuCheckOutcome: 'IUUOK' })
    )

    expect(message.reference).toBe('{reference}')
  })
})
