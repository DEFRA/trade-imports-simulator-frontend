// Maps between the simulator's control model (POST/PUT /control/cheds) and the CHED form's flat values.
// toModel lays the form over a base model, a scenario or the loaded CHED, so anything the form
// doesn't show is kept as it was. That includes the CHED type, fixed when the CHED is started, and
// the status, which the simulator drives.

// How a commodity line's quantity is given, by CHED type: animals (CHED-A) are counted, everything
// else is weighed. These are the units the stub's customs ledger understands; mass units convert
// between themselves, and a count never mixes with a mass.
const volume = {
  heading: 'Volume',
  measure: 'netVolume',
  units: [{ code: 'H87', text: 'Unit' }],
  defaultUnit: 'H87'
}
const weight = {
  heading: 'Weight',
  measure: 'netWeight',
  units: [
    { code: 'GRM', text: 'G' },
    { code: 'KGM', text: 'KG' },
    { code: 'TNE', text: 'Tonne' }
  ],
  defaultUnit: 'KGM'
}

export function quantityOf(model) {
  return model?.exchangedDocument?.includedNote?.CHED_TYPE === 'A'
    ? volume
    : weight
}

export function fromModel(model) {
  const document = model?.exchangedDocument ?? {}
  const consignment = model?.specifiedConsignment ?? {}
  const declaration = document.declaration?.includedClause ?? {}
  const lines = consignment.includedConsignmentItem?.includedTradeLineItem ?? []
  const quantity = quantityOf(model)

  return {
    purpose: declaration.PURPOSE ?? '',
    goodsCertifiedAs: declaration.GOODS_CERTIFIED_AS ?? '',
    bcp: consignment.unloadingBaseportLocation?.identifier ?? '',
    consignor: consignment.consignorParty?.identifier ?? '',
    consignee: consignment.consigneeParty?.identifier ?? '',
    exportCountry: consignment.exportCountry ?? '',
    importCountry: consignment.importCountry ?? '',
    lines: lines.map((line) => fromLine(line, quantity))
  }
}

function fromLine(line, quantity) {
  const amount = line[quantity.measure]

  return {
    cnCode: line.applicableClassification?.CN ?? '',
    originCountry: line.originCountry ?? '',
    quantity: amount ? String(amount.value) : '',
    unit: amount?.unitCode ?? ''
  }
}

export function toModel(base, values) {
  const model = structuredClone(base ?? {})
  const quantity = quantityOf(model)

  const declaration = ['exchangedDocument', 'declaration', 'includedClause']
  set(model, [...declaration, 'PURPOSE'], values.purpose)
  set(model, [...declaration, 'GOODS_CERTIFIED_AS'], values.goodsCertifiedAs)

  const consignment = ['specifiedConsignment']
  set(
    model,
    [...consignment, 'unloadingBaseportLocation', 'identifier'],
    values.bcp
  )
  set(model, [...consignment, 'consignorParty', 'identifier'], values.consignor)
  set(model, [...consignment, 'consigneeParty', 'identifier'], values.consignee)
  set(model, [...consignment, 'exportCountry'], values.exportCountry)
  set(model, [...consignment, 'importCountry'], values.importCountry)

  // The form doesn't ask for these countries because they follow from the two above: the consignor
  // sends from the export country, and the consignee and the border control post are in the import country.
  set(
    model,
    [...consignment, 'consignorParty', 'postalAddress', 'countryId'],
    values.exportCountry
  )
  set(
    model,
    [...consignment, 'consigneeParty', 'postalAddress', 'countryId'],
    values.importCountry
  )
  set(
    model,
    [...consignment, 'unloadingBaseportLocation', 'countryId'],
    values.importCountry
  )

  const item = [...consignment, 'includedConsignmentItem']
  const baseLines = get(model, [...item, 'includedTradeLineItem']) ?? []
  set(
    model,
    [...item, 'includedTradeLineItem'],
    values.lines.map((line, index) => toLine(baseLines[index], line, quantity))
  )

  return model
}

// The line's other measure (a weight on a CHED-A, say) and its packaging are left as the base had
// them: the form doesn't show them, so it mustn't drop them.
function toLine(base, values, quantity) {
  const line = structuredClone(base ?? {})

  set(line, ['applicableClassification', 'CN'], values.cnCode)
  set(line, ['originCountry'], values.originCountry)
  set(
    line,
    [quantity.measure],
    values.quantity === ''
      ? undefined
      : {
          value: Number(values.quantity),
          unitCode: values.unit || quantity.defaultUnit
        }
  )

  return line
}

function get(target, path) {
  return path.reduce((node, key) => node?.[key], target)
}

// A blank value removes the field, so clearing a form field clears it in the model.
function set(target, path, value) {
  const parent = path
    .slice(0, -1)
    .reduce((node, key) => (node[key] ??= {}), target)
  const key = path.at(-1)

  if (value === '' || value === undefined) {
    delete parent[key]
  } else {
    parent[key] = value
  }
}
