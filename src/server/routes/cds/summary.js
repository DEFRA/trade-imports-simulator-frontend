import { formatDate } from '#/config/nunjucks/filters/format-date.js'
import { checkCodes } from './check-codes.js'
import { countries } from './countries.js'
import {
  declarationTypes,
  goodsLocations,
  procedureCodes
} from './declaration-codes.js'
import { documentCodes } from './document-codes.js'
import { finalStates } from './final-states.js'
import { commodityDescriptions } from './tariff.js'

const byCode = (list, nameOf = ({ name }) => name) =>
  new Map(list.map((entry) => [entry.code, nameOf(entry)]))

const names = {
  countries: byCode(countries),
  declarationTypes: byCode(declarationTypes),
  goodsLocations: byCode(goodsLocations),
  procedureCodes: byCode(procedureCodes),
  documentCodes: byCode(documentCodes, ({ authority }) => authority),
  checkCodes: byCode(checkCodes, ({ department }) => department),
  finalStates: byCode(finalStates)
}

// A code with its name, as the form's selects show it: "CN – China". A code the list lacks stands alone.
const named = (list, code) => {
  if (code === undefined || code === null || code === '') return ''
  const name = names[list].get(String(code))
  return name ? `${code} – ${name}` : String(code)
}

const time = (value) =>
  value ? formatDate(new Date(value), 'd MMM yyyy HH:mm') : ''

const text = (value) =>
  value === undefined || value === null ? '' : String(value)

// One version of a clearance request, as the Request tab shows it: the header as summary-list rows,
// and each item with its documents and checks.
export async function summariseRequest(request) {
  const header = request.header ?? {}
  const descriptions = await commodityDescriptions()

  return {
    rows: [
      ['Declaration UCR', text(header.declarationUCR)],
      ['Declaration type', named('declarationTypes', header.declarationType)],
      ['Arrival', time(header.arrivalDateTime)],
      ['Declarant', text(header.declarantId)],
      ['Submitter TURN', text(header.submitterTURN)],
      ['Dispatch country', named('countries', header.dispatchCountryCode)],
      ['Goods location', named('goodsLocations', header.goodsLocationCode)],
      ['Master UCR', text(header.masterUCR)]
    ].map(([key, value]) => ({ key: { text: key }, value: { text: value } })),
    items: (request.items ?? []).map((item) => ({
      number: item.itemNumber,
      commodity: text(item.taricCommodityCode),
      commodityDescription:
        descriptions.get(item.taricCommodityCode) ??
        text(item.goodsDescription),
      procedure: named('procedureCodes', item.customsProcedureCode),
      origin: named('countries', item.itemOriginCountryCode),
      netMass: text(item.itemNetMass),
      supplementaryUnits: text(item.itemSupplementaryUnits),
      documents: (item.documents ?? []).map((document) => ({
        code: named('documentCodes', document.documentCode),
        reference: text(document.documentReference),
        status: text(document.documentStatus),
        control: text(document.documentControl)
      })),
      checks: (item.checks ?? []).map((check) => ({
        code: named('checkCodes', check.checkCode),
        department: text(check.departmentCode)
      }))
    }))
  }
}

// BTMS's decision codes by family, from the decision deriver's DecisionRulesEngine-QuickReference.md:
// C releases the goods, H holds them for a check, N finds them not acceptable, X00 matched no CHED.
const decisionFamilies = {
  C: { name: 'Release', classes: 'app-tag--green' },
  H: { name: 'Hold', classes: 'app-tag--yellow' },
  N: { name: 'Not acceptable', classes: 'app-tag--red' },
  X: { name: 'No match', classes: 'app-tag--grey' },
  E: { name: 'IUU hold', classes: 'app-tag--yellow' }
}

function decisionTag(code) {
  const family = decisionFamilies[code?.[0]]
  return family
    ? { text: `${code} ${family.name}`, classes: family.classes }
    : { text: text(code), classes: 'app-tag--grey' }
}

// What BTMS sent back, grouped by the version it answered, as the Decisions tab shows it: the latest
// version first (the order findDeclaration gives), and in each the replies newest first. A decision lists the version's items as the
// Request tab does, each with BTMS's decision on its checks. BTMS leaves out an item with no checks,
// so such an item shows none.
export async function summariseReplies({ versions, decisions, errors }) {
  const descriptions = await commodityDescriptions()
  const newestFirst = (a, b) => (a.timestamp < b.timestamp ? 1 : -1)

  return versions.map(({ entryVersionNumber: version, timestamp, request }) => {
    const replies = [
      ...decisions
        .filter((decision) => decision.entryVersionNumber === version)
        .map((decision) => {
          const decided = new Map(
            decision.items.map((item) => [item.itemNumber, item.checks])
          )
          return {
            kind: 'decision',
            timestamp: decision.timestamp,
            title: `Decision ${text(decision.decisionNumber)}`,
            items: (request.items ?? []).map((item) => ({
              number: item.itemNumber,
              commodity: text(item.taricCommodityCode),
              commodityDescription:
                descriptions.get(item.taricCommodityCode) ?? '',
              checks: (decided.get(item.itemNumber) ?? []).map((check) => ({
                code: named('checkCodes', check.checkCode),
                decision: decisionTag(check.decisionCode),
                reason: text(check.decisionReason)
              }))
            }))
          }
        }),
      ...errors
        .filter((error) => error.entryVersionNumber === version)
        .map((error) => ({
          kind: 'error',
          timestamp: error.timestamp,
          title: 'Refused',
          errors: error.errors.map(({ errorCode, errorMessage }) => ({
            code: text(errorCode),
            message: text(errorMessage)
          }))
        }))
    ]
      .sort(newestFirst)
      .map((reply) => ({ ...reply, received: time(reply.timestamp) }))

    return {
      version,
      sent: time(timestamp),
      latestReply: replies[0]?.title ?? 'No reply',
      replies
    }
  })
}

// A finalisation, as the Finalise tab lists it.
export function summariseFinalisation({
  entryVersionNumber,
  timestamp,
  finalisation
}) {
  const header = finalisation.header ?? {}
  return {
    version: entryVersionNumber,
    sent: time(timestamp),
    finalState: named('finalStates', header.finalState),
    manualAction: header.manualAction === 'Y' ? 'Yes' : 'No',
    decisionNumber: text(header.decisionNumber)
  }
}

export { time }
