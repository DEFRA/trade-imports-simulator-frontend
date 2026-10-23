import Joi from 'joi'

import {
  createClearanceRequest,
  createFinalisation,
  getDeclaration,
  listDeclarations,
  listScenarios,
  saveScenario
} from '#/server/common/clients/cds-simulator.js'
import { apiRoute, relay } from '#/server/common/helpers/api-route.js'
import { pagination } from '#/server/common/helpers/pagination.js'
import { selectItems } from '#/server/common/helpers/select-items.js'
import { blankDeclaration } from './blank-declaration.js'
import {
  checkCodes,
  combinations,
  documentControls,
  documentStatuses
} from './check-codes.js'
import { countries } from './countries.js'
import {
  declarationTypes,
  goodsLocations,
  procedureCodes
} from './declaration-codes.js'
import { documentCodes } from './document-codes.js'
import { finalStates } from './final-states.js'
import {
  summariseFinalisation,
  summariseReplies,
  summariseRequest,
  time
} from './summary.js'
import { commodityTreeJson } from './tariff.js'

// An MRN as CDS issues them, e.g. 26GB0P19E7LGB46A2V: two digits of year, a country, 14 more.
const mrn = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^\d{2}[A-Z]{2}[A-Z0-9]{14}$/)

const codes = (list) => list.map((code) => ({ value: code, text: code }))
const joined = (list) => list.join(' + ') || 'no document'

// Made-up EORIs, GB999000000001 to GB999000001000, for the declarant input to suggest.
const declarants = Array.from(
  { length: 1000 },
  (_, i) => `GB999${String(i + 1).padStart(9, '0')}`
)

// The form's select options. Countries, goods locations and procedure codes offer a blank, so a
// request without one keeps none; a new declaration gets its values from the blank start.
// A combination's value is its place in the list, which the client looks up in `lookups`.
const formItems = {
  declarants,
  declarationTypes: selectItems(declarationTypes),
  goodsLocations: selectItems(goodsLocations, { blank: true }),
  procedureCodes: selectItems(procedureCodes, { blank: true }),
  documentCodes: documentCodes.map(({ code, authority }) => ({
    value: code,
    text: `${code} – ${authority}`
  })),
  documentStatuses: codes(documentStatuses),
  documentControls: codes(documentControls),
  checkCodes: checkCodes.map(({ code, department }) => ({
    value: code,
    text: `${code} – ${department}`
  })),
  combinations: [
    { value: '', text: 'Set checks and documents from a common combination' },
    ...combinations.map(({ checks, documents }, index) => ({
      value: String(index),
      text: `${joined(checks)} → ${joined(documents)}`
    }))
  ],
  lookups: {
    departments: Object.fromEntries(
      checkCodes.map(({ code, department }) => [code, department])
    ),
    combinations
  },
  countries: selectItems(countries, { blank: true })
}

const finalStateItems = selectItems(finalStates)

// Every declaration in the simulator, most recently sent first, a page at a time.
export const cdsController = {
  options: {
    validate: {
      query: Joi.object({ page: Joi.number().integer().min(1).default(1) })
    }
  },
  async handler(request, h) {
    const { page } = request.query
    const { items, hasMore } = await listDeclarations({ page })
    return h.view('cds/index', {
      pageTitle: 'CDS',
      declarations: items.map(({ mrn, entryVersionNumber, timestamp }) => ({
        mrn,
        version: entryVersionNumber,
        sent: time(timestamp)
      })),
      pastFirstPage: page > 1,
      pagination: pagination(page, hasMore, {
        path: '/cds',
        landmarkLabel: 'Declaration pages',
        newer: 'newer declarations',
        older: 'older declarations'
      })
    })
  }
}

// A new declaration starts blank or from a scenario the simulator holds.
export const createDeclarationController = {
  async handler(_request, h) {
    const saved = await listScenarios()
    return h.view('cds/create', {
      pageTitle: 'Create a declaration',
      scenarioItems: [
        { value: '', text: 'Choose a scenario' },
        ...saved.map(({ id, name }) => ({ value: id, text: name }))
      ],
      startModels: Object.fromEntries([
        ['blank', blankDeclaration()],
        ...saved.map(({ id, model }) => [id, model])
      ]),
      items: formItems
    })
  }
}

// "Open a declaration" is a plain GET form, so the MRN arrives as a query and is moved into the path.
export const openDeclarationController = {
  options: { validate: { query: Joi.object({ mrn: mrn.required() }) } },
  handler: (request, h) =>
    h.redirect(`/cds/declarations/${encodeURIComponent(request.query.mrn)}`)
}

const mrnParam = { validate: { params: Joi.object({ mrn: mrn.required() }) } }

// Reads a declaration with its versions newest first, as every tab lists them.
async function findDeclaration(mrn) {
  const declaration = await getDeclaration(mrn)
  declaration.versions.sort(
    (a, b) => b.entryVersionNumber - a.entryVersionNumber
  )
  return declaration
}

// What the tabbed pages share: the MRN and its latest version, for the header.
const heading = ({ mrn, versions }) => ({
  mrn,
  version: versions[0].entryVersionNumber
})

// The Request tab: the latest version as sent, then the ones before it, newest first.
export const declarationController = {
  options: mrnParam,
  async handler(request, h) {
    const declaration = await findDeclaration(request.params.mrn)
    const versions = await Promise.all(
      declaration.versions.map(
        async ({ entryVersionNumber, timestamp, request: sent }) => ({
          version: entryVersionNumber,
          sent: time(timestamp),
          ...(await summariseRequest(sent))
        })
      )
    )
    return h.view('cds/declaration', {
      pageTitle: declaration.mrn,
      declaration: heading(declaration),
      latest: versions[0],
      earlier: versions.slice(1)
    })
  }
}

// The Decisions tab: what BTMS sent back, by the version it answered, the latest first.
export const decisionsController = {
  options: mrnParam,
  async handler(request, h) {
    const declaration = await findDeclaration(request.params.mrn)
    const versions = await summariseReplies(declaration)
    return h.view('cds/decisions', {
      pageTitle: `${declaration.mrn} decisions`,
      declaration: heading(declaration),
      latest: versions[0],
      earlier: versions.slice(1)
    })
  }
}

// The Finalise tab. BTMS takes a finalisation only for the latest version (ALVSVAL401), so that's the
// one offered, with the number of BTMS's latest decision on it.
export const finaliseController = {
  options: {
    validate: {
      ...mrnParam.validate,
      query: Joi.object({ finalised: Joi.boolean() })
    }
  },
  async handler(request, h) {
    const declaration = await findDeclaration(request.params.mrn)
    const header = heading(declaration)
    const decisionNumbers = declaration.decisions
      .filter((decision) => decision.entryVersionNumber === header.version)
      .map((decision) => decision.decisionNumber)
      .filter(Boolean)
    return h.view('cds/finalise', {
      pageTitle: `Finalise ${declaration.mrn}`,
      declaration: header,
      finalised: request.query.finalised,
      decisionNumber: decisionNumbers.length
        ? Math.max(...decisionNumbers)
        : '',
      finalStates: finalStateItems,
      finalisations: [...declaration.finalisations]
        .reverse()
        .map(summariseFinalisation)
    })
  }
}

// The form starts from the declaration's latest version and sends the next one.
export const amendDeclarationController = {
  options: mrnParam,
  async handler(request, h) {
    const declaration = await findDeclaration(request.params.mrn)
    const [latest] = declaration.versions
    return h.view('cds/amend', {
      pageTitle: `Amend ${declaration.mrn}`,
      mrn: declaration.mrn,
      version: latest.entryVersionNumber,
      model: latest.request,
      items: formItems
    })
  }
}

export const createClearanceRequestApiController = {
  options: apiRoute({ payload: Joi.object().required() }),
  handler: (request, h) =>
    relay(h, () => createClearanceRequest(request.payload), 201)
}

// The Finalise tab's form: which version, what became of the goods, and whether by hand. The request
// is built here, in the contract's shape, so the page sends only what the user chose.
export const createFinalisationApiController = {
  options: apiRoute({
    ...mrnParam.validate,
    payload: Joi.object({
      version: Joi.number().integer().min(1).required(),
      finalState: Joi.string()
        .valid(...finalStates.map(({ code }) => code))
        .required(),
      manualAction: Joi.string().valid('Y', 'N').required(),
      decisionNumber: Joi.number().integer().min(1).max(9999)
    })
  }),
  handler: (request, h) => {
    const { version, finalState, manualAction, decisionNumber } =
      request.payload
    return relay(
      h,
      () =>
        createFinalisation({
          serviceHeader: { sourceSystem: 'CDS', destinationSystem: 'ALVS' },
          header: {
            entryReference: request.params.mrn,
            entryVersionNumber: version,
            finalState,
            manualAction,
            decisionNumber
          }
        }),
      201
    )
  }
}

export const saveScenarioApiController = {
  options: apiRoute({
    params: Joi.object({
      id: Joi.string().pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }),
    payload: Joi.object({
      name: Joi.string().trim().required(),
      model: Joi.object().required()
    })
  }),
  handler: (request, h) =>
    relay(h, () => saveScenario(request.params.id, request.payload))
}

// The commodity picker's data: the whole tariff, about 1.9 MB of JSON before compression. It only
// changes with a deployment, so the browser keeps it for the day.
export const commoditiesApiController = {
  options: { tags: ['api'] },
  async handler(_request, h) {
    return h
      .response(await commodityTreeJson())
      .type('application/json')
      .header('cache-control', 'private, max-age=86400')
  }
}
