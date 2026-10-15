import { sendJson } from '../send-json.js'

// A decision form: posts its fields as JSON, then returns to the CHED, whose page shows the new
// status. On refusal it shows the simulator's message instead.
export class DecisionForm {
  constructor(form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const button = form.querySelector('button')
      const error = document.getElementById(form.dataset.error)
      const values = Object.fromEntries(new FormData(form))

      button.disabled = true
      error.hidden = true
      try {
        await sendJson(form.dataset.action, 'POST', values)
        window.location.assign(
          `${form.dataset.done}?decided=${values.decision}`
        )
      } catch (failure) {
        error.querySelector('[data-decision-error-detail]').textContent =
          failure.message
        error.hidden = false
        button.disabled = false
      }
    })
  }
}
