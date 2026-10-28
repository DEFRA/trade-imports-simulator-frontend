import {
  SET_BY_SIMULATOR,
  describeNotificationMessage,
  notificationBody
} from './notification-request.js'

describe('#notificationBody', () => {
  test('Should send None as null', () => {
    expect(notificationBody({ iuuOption: '' })).toEqual({ iuuOption: null })
  })

  test('Should send an IUU option as it is', () => {
    expect(notificationBody({ iuuOption: 'IUUNA' })).toEqual({
      iuuOption: 'IUUNA'
    })
  })
})

describe('#describeNotificationMessage', () => {
  test('Should show every field of a create, nulls included', () => {
    expect(
      JSON.parse(
        describeNotificationMessage('POST', {
          reference: 'IUU.GB.2026.0000001',
          iuuOption: ''
        })
      )
    ).toEqual({
      resourceId: 'IUU.GB.2026.0000001',
      resourceType: 'IuuNotification',
      subResourceType: null,
      operation: 'Created',
      resource: {
        id: 'IUU.GB.2026.0000001',
        etag: SET_BY_SIMULATOR,
        created: SET_BY_SIMULATOR,
        updated: SET_BY_SIMULATOR,
        iuuNotification: {
          reference: 'IUU.GB.2026.0000001',
          lastUpdated: SET_BY_SIMULATOR,
          iuuOption: null
        }
      },
      etag: SET_BY_SIMULATOR,
      timestamp: SET_BY_SIMULATOR,
      changeSet: []
    })
  })

  test('Should show a placeholder until there is a reference', () => {
    const message = JSON.parse(
      describeNotificationMessage('POST', { reference: ' ', iuuOption: '' })
    )

    expect(message.resourceId).toBe('{reference}')
  })

  test('Should keep the created time of an update', () => {
    const message = JSON.parse(
      describeNotificationMessage(
        'PUT',
        { reference: 'IUU.GB.2026.0000001', iuuOption: 'IUUNA' },
        '2026-10-28T09:00:00.000Z'
      )
    )

    expect(message.operation).toBe('Updated')
    expect(message.resource.created).toBe('2026-10-28T09:00:00.000Z')
    expect(message.resource.iuuNotification.iuuOption).toBe('IUUNA')
  })
})
