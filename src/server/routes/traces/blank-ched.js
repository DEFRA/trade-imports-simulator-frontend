// A blank CHED of one type, arriving in Northern Ireland. The form's first options fill in the rest.
export function blankChed(type) {
  return {
    exchangedDocument: { includedNote: { CHED_TYPE: type } },
    specifiedConsignment: { importCountry: 'XI' }
  }
}
