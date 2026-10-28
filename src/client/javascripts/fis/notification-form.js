import { sendJson } from '../send-json.js'

// The IUU notification form. "Use next ID" asks the simulator for the reference after its largest.
// Sending posts the IUU option, or null for None, as JSON to the reference's URL, then opens the notification. On
// refusal it shows the simulator's message instead: a reference that exists already, say (409).
export class NotificationForm {
  constructor(form) {
    this.form = form
    this.error = document.getElementById(form.dataset.error)

    form
      .querySelector('[data-next-id]')
      ?.addEventListener('click', ({ currentTarget }) =>
        this.useNextId(currentTarget)
      )

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.send()
    })
  }

  async useNextId(button) {
    button.disabled = true
    this.error.hidden = true
    try {
      const { nextId } = await sendJson(button.dataset.nextId, 'GET')
      this.form.elements.reference.value = nextId
    } catch (failure) {
      this.showError(failure)
    } finally {
      button.disabled = false
    }
  }

  async send() {
    const button = this.form.querySelector('button[type="submit"]')
    const values = Object.fromEntries(new FormData(this.form))
    const reference = values.reference.trim()
    const path = (template) =>
      template.replace('{reference}', encodeURIComponent(reference))

    if (!reference) {
      this.showError(new Error('Enter an IUU reference, or use the next ID.'))
      return
    }

    button.disabled = true
    this.error.hidden = true
    try {
      await sendJson(path(this.form.dataset.action), this.form.dataset.method, {
        // None is blank in the form, and null to the simulator.
        iuuOption: values.iuuOption || null
      })
      window.location.assign(path(this.form.dataset.done))
    } catch (failure) {
      this.showError(failure)
      button.disabled = false
    }
  }

  showError(failure) {
    this.error.querySelector('[data-notification-error-detail]').textContent =
      failure.message
    this.error.hidden = false
  }
}
