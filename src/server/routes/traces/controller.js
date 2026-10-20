import Boom from '@hapi/boom'
import Joi from 'joi'

import {
  ControlApiError,
  createChed,
  getChed,
  listCheds,
  listScenarios,
  saveScenario,
  updateChed
} from '#/server/common/clients/certificate-control.js'

import { getReferenceData } from '#/server/common/services/reference-data.js'
import { blankChed } from './blank-ched.js'
import { applyDecision, checkClauses, decisionStatuses } from './decisions.js'
import { trimmedTree } from './commodity-trees.js'

function items(list, { blank } = {}) {
  const options = list.map(({ code, name }) => ({
    value: code,
    text: `${code} – ${name}`
  }))
  return blank ? [{ value: '', text: '' }, ...options] : options
}

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

// Reads a CHED, turning the simulator's 404 into this app's.
async function findChed(id) {
  try {
    return summarise(await getChed(id))
  } catch (error) {
    if (error instanceof ControlApiError && error.status === 404) {
      throw Boom.notFound(error.message)
    }
    throw error
  }
}

// The stub says only whether another page follows, not how many there are, so the numbers run
// from 1 to the page after this one: 1 … 4 [5] 6.
function pagination(page, hasMore) {
  if (page === 1 && !hasMore) {
    return undefined
  }
  const link = (number) => ({
    number,
    href: `/traces?page=${number}`,
    current: number === page
  })
  const last = hasMore ? page + 1 : page
  const items = [link(1)]
  if (page > 3) {
    items.push({ ellipsis: true })
  }
  for (let number = Math.max(2, page - 1); number <= last; number++) {
    items.push(link(number))
  }
  return {
    landmarkLabel: 'CHED pages',
    previous:
      page > 1
        ? { href: `/traces?page=${page - 1}`, labelText: 'newer CHEDs' }
        : undefined,
    next: hasMore
      ? { href: `/traces?page=${page + 1}`, labelText: 'older CHEDs' }
      : undefined,
    items
  }
}

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
      pagination: pagination(page, hasMore)
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

// A new CHED starts blank, as one of the types, or from a scenario the stub holds.
export const createChedController = {
  async handler(_request, h) {
    const [{ chedTypes }, scenarios] = await Promise.all([
      getReferenceData(),
      listScenarios()
    ])
    const blanks = chedTypes.map(({ code }) => ({
      id: `blank-${code}`,
      text: `CHED-${code}`,
      model: blankChed(code)
    }))

    return h.view('traces/create', {
      pageTitle: 'Create a CHED',
      blankStarts: blanks,
      scenarioItems: [
        { value: '', text: 'Choose a scenario' },
        ...scenarios.map(({ id, name }) => ({ value: id, text: name }))
      ],
      startModels: Object.fromEntries(
        [...blanks, ...scenarios].map(({ id, model }) => [id, model])
      ),
      items: await formItems()
    })
  }
}

// The JSON routes the pages' client modules call. Each passes the stub's answer back, problems
// included, so a page shows the simulator's own message.
const apiRoute = (validate) => ({
  tags: ['api'],
  plugins: { crumb: { restful: true } },
  validate
})

async function relay(h, act, code = 200) {
  try {
    return h.response(await act()).code(code)
  } catch (error) {
    if (error instanceof ControlApiError) {
      return h
        .response(error.problem ?? { detail: error.message })
        .type('application/problem+json')
        .code(error.status)
    }
    throw error
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
