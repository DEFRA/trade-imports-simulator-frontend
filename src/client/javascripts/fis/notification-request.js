// What the IUU notification form sends the FIS simulator, and the message the simulator then publishes
// to BTMS, as the form's message panel shows it. None is blank in the form, and null to the simulator.
export const notificationBody = ({ iuuOption }) => ({
  iuuOption: iuuOption || null
})

// What only the simulator knows until it sends: a new etag and the time.
export const SET_BY_SIMULATOR = '<set by the simulator>'

const pretty = (json) => JSON.stringify(json, null, 2)

// The ResourceEvent the simulator publishes, every field as System.Text.Json writes it, nulls and the
// empty change set included. A create is stamped when sent; an update keeps the `created` it holds.
// A reference not given yet shows as a placeholder.
export function describeNotificationMessage(method, values, created) {
  const reference = values.reference?.trim() || '{reference}'
  return pretty({
    resourceId: reference,
    resourceType: 'IuuNotification',
    subResourceType: null,
    operation: method === 'PUT' ? 'Updated' : 'Created',
    resource: {
      id: reference,
      etag: SET_BY_SIMULATOR,
      created: created || SET_BY_SIMULATOR,
      updated: SET_BY_SIMULATOR,
      iuuNotification: {
        reference,
        lastUpdated: SET_BY_SIMULATOR,
        ...notificationBody(values)
      }
    },
    etag: SET_BY_SIMULATOR,
    timestamp: SET_BY_SIMULATOR,
    changeSet: []
  })
}
