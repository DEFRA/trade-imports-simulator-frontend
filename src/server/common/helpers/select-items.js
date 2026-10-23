// A code list as select options, "CN – China". A code with no name stands alone.
export function selectItems(list, { blank } = {}) {
  const options = list.map(({ code, name }) => ({
    value: code,
    text: name ? `${code} – ${name}` : code
  }))
  return blank ? [{ value: '', text: '' }, ...options] : options
}
