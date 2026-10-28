// What the IUU notification form sends the FIS simulator, and the message the simulator then publishes
// to BTMS, as the form's message panel shows it. None is blank in the form, and null to the simulator
// and in the message.
export const notificationBody = ({ iuuCheckOutcome }) => ({
  iuuCheckOutcome: iuuCheckOutcome || null
})

// What only the simulator knows until it sends: the time.
export const SET_BY_SIMULATOR = '<set by the simulator>'

// The IuuNotification the simulator publishes, the same for a create and an update. A reference not
// given yet shows as a placeholder.
export function describeNotificationMessage(values) {
  return JSON.stringify(
    {
      reference: values.reference?.trim() || '{reference}',
      lastUpdated: SET_BY_SIMULATOR,
      ...notificationBody(values)
    },
    null,
    2
  )
}
