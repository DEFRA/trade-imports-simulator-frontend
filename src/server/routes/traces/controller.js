import Boom from '@hapi/boom'
import Joi from 'joi'

import {
  createChed,
  getChed,
  listCheds,
  listScenarios,
  saveScenario,
  updateChed
} from '#/server/common/clients/certificate-control.js'

import { getReferenceData } from '#/server/common/services/reference-data.js'
import { apiRoute, relay } from '#/server/common/helpers/api-route.js'
import { pagination } from '#/server/common/helpers/pagination.js'
import { selectItems as items } from '#/server/common/helpers/select-items.js'
import { blankChed } from './blank-ched.js'
import { applyDecision, checkClauses, decisionStatuses } from './decisions.js'
import { trimmedTree } from './commodity-trees.js'

async function formItems() {
  const lists = await getReferenceData()
  return {
    purposes: items(lists.consignmentClauses),
    goodsCertifiedAs: items(lists.consignmentClauses),
    borderControlPosts: items(lists.borderControlPosts),
    operators: items(lists.operators),
    countries: items(lists.countries),
    // A commodity line starts empty, so its select opens on a blank.
    lineCountries: items(lists.countries, { blank: true })
  }
}

const idParam = {
  validate: {
    params: Joi.object({
      id: Joi.string().pattern(/^CHED[A-Z]+\.[A-Z]{2}\.\d{4}\.\d+$/)
    })
  }
}

// A CHED as the pages show it. The simulator starts every CHED as NEW without recording a status.
function summarise({ id, accessible, updated, certificate }) {
  return {
    id,
    accessible,
    updated,
    type: certificate.exchangedDocument?.includedNote?.CHED_TYPE,
    status: certificate.status ?? 'NEW',
    model: certificate
  }
}

const findChed = async (id) => summarise(await getChed(id))

// Every CHED in the simulator, newest first, a page at a time.
export const chedListController = {
  options: {
    validate: {
      query: Joi.object({ page: Joi.number().integer().min(1).default(1) })
    }
  },
  async handler(request, h) {
    const { page } = request.query
    const { items, hasMore } = await listCheds({ page })
    return h.view('traces/list', {
      pageTitle: 'CHEDs',
      cheds: items.map(summarise),
      pastFirstPage: page > 1,
      pagination: pagination(page, hasMore, {
        path: '/traces',
        landmarkLabel: 'CHED pages',
        newer: 'newer CHEDs',
        older: 'older CHEDs'
      })
    })
  }
}

// "Open a CHED" is a plain GET form, so the reference arrives as a query and is moved into the path.
export const openChedController = {
  options: {
    validate: { query: Joi.object({ id: Joi.string().trim().required() }) }
  },
  handler(request, h) {
    return h.redirect(`/traces/cheds/${encodeURIComponent(request.query.id)}`)
  }
}

// A new CHED's arrival at the border control post, which the form doesn't show: this time tomorrow,
// to the minute.
function tomorrow() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  date.setSeconds(0, 0)
  return date.toISOString()
}

// A new CHED starts blank, as one of the types, or from a scenario the stub holds. Without a start
// the page asks for one; with one it's the form, filled from that start.
export const createChedController = {
  options: {
    validate: { query: Joi.object({ start: Joi.string().trim() }) }
  },
  async handler(request, h) {
    const [{ chedTypes }, scenarios] = await Promise.all([
      getReferenceData(),
      listScenarios()
    ])
    const blanks = chedTypes.map(({ code }) => ({
      id: `blank-${code}`,
      name: `CHED-${code}`,
      model: blankChed(code)
    }))
    const { start } = request.query

    if (!start) {
      return h.view('traces/start', {
        pageTitle: 'Create a CHED',
        blankStarts: blanks,
        scenarioItems: [
          { value: '', text: 'Choose a scenario' },
          ...scenarios.map(({ id, name }) => ({ value: id, text: name }))
        ]
      })
    }

    const chosen = [...blanks, ...scenarios].find(({ id }) => id === start)
    if (!chosen) throw Boom.notFound(`There is no scenario ${start}`)
    const model = structuredClone(chosen.model)
    model.specifiedConsignment ??= {}
    model.specifiedConsignment.availabilityDueDateTime ??= tomorrow()

    return h.view('traces/create', {
      pageTitle: 'Create a CHED',
      startName: chosen.name,
      model,
      items: await formItems()
    })
  }
}

export const createChedApiController = {
  options: apiRoute({ payload: Joi.object().required() }),
  handler: (request, h) => relay(h, () => createChed(request.payload), 201)
}

// The edit form sends the whole model, so a line removed in the form is removed in the CHED.
export const updateChedApiController = {
  options: apiRoute({ ...idParam.validate, payload: Joi.object().required() }),
  handler: (request, h) =>
    relay(h, () => updateChed(request.params.id, request.payload))
}

export const decideChedApiController = {
  options: apiRoute({
    ...idParam.validate,
    payload: Joi.object({
      status: Joi.string()
        .valid(...decisionStatuses)
        .required(),
      ...Object.fromEntries(
        Object.entries(checkClauses).map(([clause, codes]) => [
          clause,
          Joi.string().valid(...codes, '')
        ])
      )
    })
  }),
  handler: (request, h) =>
    relay(h, async () => {
      const { id, certificate } = await getChed(request.params.id)
      return updateChed(id, applyDecision(certificate, request.payload))
    })
}

// Saves the create form as a scenario.
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

// The commodity picker's data: one CHED type's tree, trimmed (see commodity-trees.js).
export const commodityTreeApiController = {
  options: {
    tags: ['api'],
    validate: {
      params: Joi.object({ chedType: Joi.string().valid('A', 'P', 'PP', 'D') })
    }
  },
  async handler(request, h) {
    return h
      .response(await trimmedTree(request.params.chedType))
      .header('cache-control', 'private, max-age=300')
  }
}

export const chedController = {
  options: {
    validate: {
      ...idParam.validate,
      query: Joi.object({ created: Joi.boolean() })
    }
  },
  async handler(request, h) {
    const ched = await findChed(request.params.id)
    return h.view('traces/ched', {
      pageTitle: `${ched.id} Part I`,
      ched,
      created: request.query.created,
      items: await formItems()
    })
  }
}

export const decisionController = {
  options: {
    validate: {
      ...idParam.validate,
      query: Joi.object({
        decided: Joi.string().valid(...decisionStatuses)
      })
    }
  },
  async handler(request, h) {
    const ched = await findChed(request.params.id)
    return h.view('traces/decision', {
      pageTitle: `${ched.id} Part II`,
      ched,
      decided: request.query.decided,
      // A CHED not yet decided opens as in progress, so saving it untouched is a valid choice.
      status: decisionStatuses.includes(ched.status)
        ? ched.status
        : 'IN_PROGRESS',
      clauses: ched.model.exchangedDocument?.clearance?.includedClause ?? {}
    })
  }
}
