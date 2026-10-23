import { sendJson } from '../send-json.js'

// The finalisation form. Sending posts the choices as JSON, then reloads the page, which lists the
// finalisation. On refusal it shows the simulator's message instead: a version finalised already,
// say (409).
export class FinalisationForm {
  constructor(form) {
    this.form = form
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.send()
    })
  }

  async send() {
    const button = this.form.querySelector('button')
    const error = document.getElementById(this.form.dataset.error)
    const values = Object.fromEntries(new FormData(this.form))
    const decisionNumber = values.decisionNumber.trim()

    button.disabled = true
    error.hidden = true
    try {
      await sendJson(this.form.dataset.action, 'POST', {
        version: Number(values.version),
        finalState: values.finalState,
        manualAction: values.manualAction,
        // A blank number is left out: JSON.stringify drops undefined.
        decisionNumber: decisionNumber ? Number(decisionNumber) : undefined
      })
      window.location.assign(`${this.form.dataset.done}?finalised=true`)
    } catch (failure) {
      error.querySelector('[data-finalisation-error-detail]').textContent =
        failure.message
      error.hidden = false
      button.disabled = false
    }
  }
}
