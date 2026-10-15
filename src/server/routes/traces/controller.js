import Boom from '@hapi/boom'
import Joi from 'joi'

import {
  ControlApiError,
  createChed,
  getChed,
  updateChed
} from '#/server/common/clients/certificate-control.js'

import { getReferenceData } from '#/server/common/services/reference-data.js'
import { blankChed, scenarios } from './scenarios/index.js'
import { recentChedIds, rememberChed } from './recent-cheds.js'
import { applyDecision } from './decisions.js'

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
    goodsCertifiedAs: items(lists.consignmentClauses, { blank: true }),
    borderControlPosts: items(lists.borderControlPosts),
    operators: items(lists.operators),
    countries: items(lists.countries),
    cnCodes: items(lists.cnCodes),
    refusalReasons: items(lists.refusalReasons, { blank: true })
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
function summarise({ id, certificate }) {
  return {
    id,
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

export const recentChedsController = {
  async handler(request, h) {
    // Each is read afresh, so the list shows current status. A reset simulator has forgotten them.
    const cheds = await Promise.all(
      recentChedIds(request).map((id) =>
        findChed(id).catch((error) =>
          error.isBoom && error.output.statusCode === 404
            ? { id, missing: true }
            : Promise.reject(error)
        )
      )
    )
    return h.view('traces/recent', { pageTitle: 'CHEDs', cheds })
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

// A new CHED starts blank, as one of the types, or from a scenario.
export const createChedController = {
  async handler(_request, h) {
    const { chedTypes } = await getReferenceData()
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
// included, so a page shows the simulator's own message. A CHED touched here joins the recent list.
const apiRoute = (validate) => ({
  tags: ['api'],
  plugins: { crumb: { restful: true } },
  validate
})

async function forward(request, h, act, code = 200) {
  try {
    const stored = await act()
    rememberChed(request, stored.id)
    return h.response(stored).code(code)
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
  handler: (request, h) =>
    forward(request, h, () => createChed(request.payload), 201)
}

// The edit form sends the whole model, so a line removed in the form is removed in the CHED.
export const updateChedApiController = {
  options: apiRoute({ ...idParam.validate, payload: Joi.object().required() }),
  handler: (request, h) =>
    forward(request, h, () => updateChed(request.params.id, request.payload))
}

export const decideChedApiController = {
  options: apiRoute({
    ...idParam.validate,
    payload: Joi.object({
      decision: Joi.string().valid('accept', 'reject').required(),
      refusalReason: Joi.string().allow('')
    })
  }),
  handler: (request, h) =>
    forward(request, h, async () => {
      const { id, certificate } = await getChed(request.params.id)
      return updateChed(id, applyDecision(certificate, request.payload))
    })
}

export const chedController = {
  options: {
    validate: {
      ...idParam.validate,
      query: Joi.object({ decided: Joi.string().valid('accept', 'reject') })
    }
  },
  async handler(request, h) {
    const ched = await findChed(request.params.id)
    return h.view('traces/ched', {
      pageTitle: ched.id,
      ched,
      decided: request.query.decided,
      items: await formItems()
    })
  }
}

export const decisionController = {
  options: idParam,
  async handler(request, h) {
    const ched = await findChed(request.params.id)
    return h.view('traces/decision', {
      pageTitle: `Decision for ${ched.id}`,
      ched,
      items: await formItems()
    })
  }
}
