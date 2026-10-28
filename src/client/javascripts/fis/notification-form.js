import { sendJson } from '../send-json.js'
import {
  describeNotificationMessage,
  notificationBody
} from './notification-request.js'

// The IUU notification form. "Use next ID" asks the simulator for the reference after its largest.
// Sending posts the IUU option, or null for None, as JSON to the reference's URL, then opens the notification. On
// refusal it shows the simulator's message instead: a reference that exists already, say (409). The
// panel `data-preview` names shows the message the simulator will publish to BTMS, and follows every
// change to the form.
export class NotificationForm {
  constructor(form) {
    this.form = form
    this.error = document.getElementById(form.dataset.error)
    this.preview = document.getElementById(form.dataset.preview)

    form.addEventListener('input', () => this.showMessage())
    form.addEventListener('change', () => this.showMessage())
    this.showMessage()

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
      this.showMessage()
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
      await sendJson(
        path(this.form.dataset.action),
        this.form.dataset.method,
        notificationBody(values)
      )
      window.location.assign(path(this.form.dataset.done))
    } catch (failure) {
      this.showError(failure)
      button.disabled = false
    }
  }

  showMessage() {
    const { method, created } = this.form.dataset
    this.preview.textContent = describeNotificationMessage(
      method,
      Object.fromEntries(new FormData(this.form)),
      created
    )
  }

  showError(failure) {
    this.error.querySelector('[data-notification-error-detail]').textContent =
      failure.message
    this.error.hidden = false
  }
}
