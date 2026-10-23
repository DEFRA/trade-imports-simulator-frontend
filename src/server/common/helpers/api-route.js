import { ControlApiError } from '../clients/json-api.js'

// The options of a JSON route a page's client module calls.
export const apiRoute = (validate) => ({
  tags: ['api'],
  plugins: { crumb: { restful: true } },
  validate
})

// Passes the simulator's answer back, problems included, so a page shows the simulator's own message.
export async function relay(h, act, code = 200) {
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
