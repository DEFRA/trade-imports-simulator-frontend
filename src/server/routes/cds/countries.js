// Countries by ISO 3166 two-letter code, named by the runtime's own CLDR data (Intl.DisplayNames),
// so the app keeps no list of its own. Every two-letter code is tried; a code CLDR can't name
// comes back unchanged, and an old code (UK, YU) canonicalises to its successor and is skipped.
const names = new Intl.DisplayNames(['en-GB'], { type: 'region' })

// CLDR names regions that aren't countries a declaration can give: unions, sub-territories it
// splits out (Ceuta & Melilla, Canary Islands), and its test and unknown codes. Kosovo (XK) stays,
// as customs uses it.
const notCountries = new Set([
  'AC',
  'CP',
  'CQ',
  'DG',
  'EA',
  'EU',
  'EZ',
  'IC',
  'QO',
  'TA',
  'UN',
  'XA',
  'XB',
  'ZZ'
])

// Customs codes CLDR doesn't have: XI is Northern Ireland under the Windsor Framework.
const customsOnly = [{ code: 'XI', name: 'Northern Ireland' }]

function load() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const countries = [...customsOnly]
  for (const first of letters) {
    for (const second of letters) {
      const code = first + second
      const name = names.of(code)
      const canonical = Intl.getCanonicalLocales(`und-${code}`)[0].split('-')[1]
      if (name !== code && canonical === code && !notCountries.has(code)) {
        countries.push({ code, name })
      }
    }
  }
  return countries.sort((a, b) => a.name.localeCompare(b.name, 'en-GB'))
}

export const countries = load()
