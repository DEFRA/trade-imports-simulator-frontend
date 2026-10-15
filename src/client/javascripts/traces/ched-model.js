// Maps between the simulator's control model (POST/PUT /control/cheds) and the CHED form's flat values.
// toModel lays the form over a base model, a scenario or the loaded CHED, so anything the form
// doesn't show is kept as it was. That includes the CHED type, fixed when the CHED is started, and
// the status, which the simulator drives.

const kilograms = { GRM: 0.001, KGM: 1, TNE: 1000 }

export function fromModel(model) {
  const document = model?.exchangedDocument ?? {}
  const consignment = model?.specifiedConsignment ?? {}
  const declaration = document.declaration?.includedClause ?? {}
  const lines = consignment.includedConsignmentItem?.includedTradeLineItem ?? []

  return {
    purpose: declaration.PURPOSE ?? '',
    goodsCertifiedAs: declaration.GOODS_CERTIFIED_AS ?? '',
    bcp: consignment.unloadingBaseportLocation?.identifier ?? '',
    consignor: consignment.consignorParty?.identifier ?? '',
    consignee: consignment.consigneeParty?.identifier ?? '',
    exportCountry: consignment.exportCountry ?? '',
    importCountry: consignment.importCountry ?? '',
    lines: lines.map(fromLine)
  }
}

function fromLine(line) {
  const weight = line.netWeight
  const pieces = line.netVolume?.unitCode === 'H87' ? line.netVolume.value : ''
  const packaging = line.physicalReferencedLogisticsPackage

  return {
    cnCode: line.applicableClassification?.CN ?? '',
    originCountry: line.originCountry ?? '',
    netWeight: weight
      ? String(weight.value * (kilograms[weight.unitCode] ?? 1))
      : '',
    pieces: String(pieces),
    packages: String(packaging?.itemQuantity ?? ''),
    packageType: packaging?.typeCode ?? ''
  }
}

export function toModel(base, values) {
  const model = structuredClone(base ?? {})

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

  const item = [...consignment, 'includedConsignmentItem']
  const baseLines = get(model, [...item, 'includedTradeLineItem']) ?? []
  set(
    model,
    [...item, 'includedTradeLineItem'],
    values.lines.map((line, index) => toLine(baseLines[index], line))
  )

  return model
}

function toLine(base, values) {
  const line = structuredClone(base ?? {})

  set(line, ['applicableClassification', 'CN'], values.cnCode)
  set(line, ['originCountry'], values.originCountry)
  set(line, ['netWeight'], measure(values.netWeight, 'KGM'))
  set(line, ['netVolume'], measure(values.pieces, 'H87'))
  set(
    line,
    ['physicalReferencedLogisticsPackage'],
    values.packages === ''
      ? undefined
      : {
          typeCode: values.packageType || 'BX',
          itemQuantity: Number(values.packages)
        }
  )

  return line
}

function measure(value, unitCode) {
  return value === '' ? undefined : { value: Number(value), unitCode }
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
