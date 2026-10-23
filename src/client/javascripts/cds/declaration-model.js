// Maps between a clearance request, as the CDS simulator takes it (the BTMS gateway contract's JSON),
// and the declaration form's flat values. toModel lays the form over a base request, a scenario or
// the version being amended, so anything the form doesn't show is kept: a document's quantity, say.
// The simulator's declarants are made up and named by their ID, so the form's one `declarant` value
// is both the declarant's ID and name. The submitter's TURN follows from it: GB999000000042 submits
// as GB888000000042.

export const headerFields = [
  'declarationType',
  'arrivalDateTime',
  'declarant',
  'dispatchCountryCode',
  'goodsLocationCode'
]
export const itemFields = [
  'taricCommodityCode',
  'customsProcedureCode',
  'itemNetMass',
  'itemSupplementaryUnits',
  'itemOriginCountryCode'
]
export const documentFields = [
  'documentCode',
  'documentReference',
  'documentStatus',
  'documentControl'
]
export const checkFields = ['checkCode', 'departmentCode']
const numbers = new Set(['itemNetMass', 'itemSupplementaryUnits'])

// The contract carries the arrival time as epoch milliseconds; the form's datetime-local input wants
// local time to the minute.
export function toLocalInput(epoch) {
  if (epoch === undefined || epoch === null || epoch === '') return ''
  const date = new Date(epoch)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value) {
  return value ? new Date(value).getTime() : undefined
}

const text = (value) =>
  value === undefined || value === null ? '' : String(value)

export function fromModel(model) {
  const header = model?.header ?? {}
  const values = Object.fromEntries(
    headerFields.map((name) => [name, text(header[name])])
  )
  values.declarant = text(header.declarantId)
  values.arrivalDateTime = toLocalInput(header.arrivalDateTime)
  values.items = (model?.items ?? []).map((item) => ({
    ...Object.fromEntries(itemFields.map((name) => [name, text(item[name])])),
    checks: (item.checks ?? []).map((check) =>
      Object.fromEntries(checkFields.map((name) => [name, text(check[name])]))
    ),
    documents: (item.documents ?? []).map((document) =>
      Object.fromEntries(
        documentFields.map((name) => [name, text(document[name])])
      )
    )
  }))
  return values
}

export function toModel(base, values) {
  const model = structuredClone(base ?? {})
  model.header ??= {}

  for (const name of headerFields) {
    if (name !== 'declarant') set(model.header, name, values[name])
  }
  set(model.header, 'declarantId', values.declarant)
  set(model.header, 'declarantName', values.declarant)
  set(model.header, 'submitterTURN', values.declarant.replace('999', '888'))
  set(model.header, 'arrivalDateTime', fromLocalInput(values.arrivalDateTime))

  const baseItems = model.items ?? []
  model.items = values.items.map((item, index) =>
    toItem(baseItems[index], item, index, values)
  )
  return model
}

// Items are numbered from 1 in the order the form shows them, as CDS numbers them. The simulator's
// declarant is also every item's consignee, so the form doesn't ask for one.
function toItem(base, values, index, header) {
  const item = structuredClone(base ?? {})
  item.itemNumber = index + 1
  set(item, 'consigneeId', header.declarant)
  set(item, 'consigneeName', header.declarant)
  // The goods description is the commodity's in the tariff. Without one (the tariff hasn't loaded,
  // or doesn't have the code), the item keeps the description it had.
  if (values.goodsDescription) item.goodsDescription = values.goodsDescription
  for (const name of itemFields) {
    set(
      item,
      name,
      numbers.has(name) && values[name] !== ''
        ? Number(values[name])
        : values[name]
    )
  }
  item.checks = mergeLines(item.checks, values.checks, checkFields)
  item.documents = mergeLines(item.documents, values.documents, documentFields)
  return item
}

// Lines, an item's checks or documents, laid over the base's lines in the same places.
function mergeLines(baseLines = [], lines, fields) {
  return lines.map((line, i) => {
    const merged = structuredClone(baseLines[i] ?? {})
    for (const name of fields) set(merged, name, line[name])
    return merged
  })
}

// An item's checks and documents set to a combination: checks with their departments, and a
// document for each code, keeping one the item already has for that code, reference and all. New
// documents start as CDS most often sends them.
export function applyCombination(item, { checks, documents }, departments) {
  const kept = [...item.documents]
  return {
    checks: checks.map((checkCode) => ({
      checkCode,
      departmentCode: departments[checkCode] ?? ''
    })),
    documents: documents.map((documentCode) => {
      const index = kept.findIndex((d) => d.documentCode === documentCode)
      return index === -1
        ? { ...newDocument, documentCode }
        : kept.splice(index, 1)[0]
    })
  }
}

// A new item starts released to free circulation, the first procedure code, with a weight to send.
export const newItem = {
  customsProcedureCode: '4000000',
  itemNetMass: '0'
}

export const newDocument = {
  documentCode: '',
  documentReference: '',
  documentStatus: 'AE',
  documentControl: 'P'
}

// The simulator issues these on a new request and refuses one that sets them. A request read back
// from the simulator, or a scenario saved from one, carries them, so they go before sending.
function withoutIssuedFields(model) {
  delete model.serviceHeader?.correlationId
  delete model.serviceHeader?.serviceCallTimestamp
  return model
}

// A new declaration: the simulator gives it an MRN and makes it version 1.
export function forCreate(model) {
  const request = withoutIssuedFields(structuredClone(model))
  delete request.header?.entryReference
  delete request.header?.entryVersionNumber
  delete request.header?.previousVersionNumber
  return request
}

// The next version of a declaration, after `version`.
export function forAmend(model, mrn, version) {
  const request = withoutIssuedFields(structuredClone(model))
  request.header ??= {}
  request.header.entryReference = mrn
  request.header.entryVersionNumber = version + 1
  request.header.previousVersionNumber = version
  return request
}

// A scenario is a starting point, so it has no MRN, and no arrival time: it gets tomorrow whenever
// it's used, rather than a date that has passed.
export function forScenario(model) {
  const scenario = forCreate(model)
  delete scenario.header?.arrivalDateTime
  return scenario
}

// An item's origin follows the dispatch country until someone sets it to something else: when the
// dispatch country changes, an origin that was empty or matched the old one takes the new one.
export function followDispatch(origin, previousDispatch, dispatch) {
  return origin === '' || origin === previousDispatch ? dispatch : origin
}

// A blank value removes the field, so clearing a form field clears it in the request.
function set(target, key, value) {
  if (value === '' || value === undefined) {
    delete target[key]
  } else {
    target[key] = value
  }
}
