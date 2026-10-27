import { sendJson } from '../send-json.js'
import { checks, checksFor, deriveStatus } from './decision-rules.js'

// The decision form. Changing a check sets the status the checks add up to; choosing a status first
// sets the checks to match. Saving posts the fields as JSON, then reloads the page, whose header
// shows the new status. On refusal it shows the simulator's message instead.
export class DecisionForm {
  constructor(form) {
    this.form = form

    form.addEventListener('change', ({ target }) => {
      if (target.name === 'status') {
        this.setClauses(checksFor(target.value, this.clauses()))
      } else if (target.type === 'radio') {
        this.setRadio('status', deriveStatus(this.clauses()))
      }
      this.update()
    })

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.save()
    })

    this.update()
  }

  clauses() {
    return Object.fromEntries(
      checks
        .flatMap(({ performed, results }) => [performed, ...results])
        .map((name) => [name, this.radio(name)])
    )
  }

  radio(name) {
    return this.form.querySelector(`[name="${name}"]:checked`)?.value ?? ''
  }

  setRadio(name, value) {
    for (const radio of this.form.querySelectorAll(`[name="${name}"]`)) {
      radio.checked = radio.value === value
    }
  }

  setClauses(clauses) {
    for (const [name, value] of Object.entries(clauses)) {
      this.setRadio(name, value)
    }
  }

  // A check not carried out has no result.
  update() {
    for (const { performed, results } of checks) {
      const notPerformed = this.radio(performed) === 'NO'
      for (const result of results) {
        for (const radio of this.form.querySelectorAll(`[name="${result}"]`)) {
          radio.disabled = notPerformed
          if (notPerformed) radio.checked = false
        }
      }
    }
  }

  async save() {
    const button = this.form.querySelector('button')
    const error = document.getElementById(this.form.dataset.error)
    const values = Object.fromEntries(new FormData(this.form))

    button.disabled = true
    error.hidden = true
    try {
      await sendJson(this.form.dataset.action, 'POST', values)
      window.location.assign(
        `${this.form.dataset.done}?decided=${values.status}`
      )
    } catch (failure) {
      error.querySelector('[data-decision-error-detail]').textContent =
        failure.message
      error.hidden = false
      button.disabled = false
    }
  }
}
