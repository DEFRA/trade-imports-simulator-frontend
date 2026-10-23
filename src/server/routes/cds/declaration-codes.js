// BTMS accepts only these two. F only came with procedure codes 4000000 and 40001CG (controlled goods
// using simplified procedures), which is why it reads as a simplified declaration.
export const declarationTypes = [
  { code: 'S', name: 'Standard' },
  { code: 'F', name: 'Simplified' }
]

// DE 1/10 then DE 1/11: the requested and previous procedures (Appendix 1), then the additional
// procedure code (Appendix 2), whose 000 means none applies.
export const procedureCodes = [
  { code: '4000000', name: 'Release to free circulation' },
  {
    code: '40001CG',
    name: 'Release to free circulation; Controlled goods using simplified procedures'
  },
  {
    code: '40001SV',
    name: 'Release to free circulation; Unit price for certain perishable goods'
  },
  {
    code: '40001BN',
    name: 'Release to free circulation; Fresh bananas without a weight certificate'
  },
  { code: '7100000', name: 'Entry to a customs warehouse' },
  {
    code: '4400000',
    name: 'Release to free circulation under end-use relief'
  }
]

export const goodsLocations = [
  { code: 'LGPLGPLGP', name: 'London Gateway Port' },
  { code: 'DEUDEUDEUGVM', name: 'Dover/Eurotunnel GVMS Port' },
  { code: 'DVRDOVDVRGVM', name: 'Dover GVMS Port' },
  { code: 'FXTFXTFXT', name: 'Felixstowe' },
  {
    code: 'HRHHRHHRHGVM',
    name: 'Harwich GVMS Port (Imports Only)'
  },
  {
    code: 'EUTEUTEUTGVM',
    name: 'Eurotunnel (Folkestone) GVMS Port'
  },
  { code: 'SOUSTNSOU', name: 'Southampton Docks' },
  { code: 'LHRLHRLHR', name: 'London Heathrow Airport' },
  { code: 'IMMIMMIMM', name: 'Immingham Docks' },
  { code: 'DEUDEUDEU', name: 'Dover/Eurotunnel' }
]
