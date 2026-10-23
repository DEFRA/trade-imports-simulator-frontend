// A finalisation's FinalState: what became of the goods. The contract's FinalStateValues, sent as the
// number's string; BTMS refuses any other (ALVSVAL402). 1 and 2 cancel the declaration.
export const finalStates = [
  { code: '0', name: 'Cleared' },
  { code: '1', name: 'Cancelled after arrival' },
  { code: '2', name: 'Cancelled while pre-lodged' },
  { code: '3', name: 'Destroyed' },
  { code: '4', name: 'Seized' },
  { code: '5', name: "Released to King's warehouse" },
  { code: '6', name: 'Transferred to MSS' }
]
