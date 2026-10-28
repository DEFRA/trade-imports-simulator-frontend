// The IUU check outcomes the Trade Imports Processor accepts. The simulator takes any value, but the
// form offers only these.
const outcomes = ['IUUOK', 'IUUNA', 'IUUNotCompliant'].map((value) => ({
  value,
  text: value
}))

// A notification can also have no outcome yet. The blank is sent as null.
export const iuuCheckOutcomes = [{ value: '', text: 'None' }, ...outcomes]

export const iuuCheckOutcomeValues = outcomes.map(({ value }) => value)
