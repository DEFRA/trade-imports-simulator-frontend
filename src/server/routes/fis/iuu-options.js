// The IUU check outcomes the Trade Imports Data API's domain package lists. The simulator takes any
// value, but the form offers only these.
export const iuuOptions = ['IUUOK', 'IUUNA', 'IUUNotCompliant'].map(
  (value) => ({ value, text: value })
)

// A new notification can also have no outcome yet. The blank is sent as null.
export const iuuOptionsWithNone = [{ value: '', text: 'None' }, ...iuuOptions]
