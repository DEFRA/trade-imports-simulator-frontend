import { fromModel, toModel } from './ched-model.js'
import { sendJson } from '../send-json.js'

const fields = [
  'purpose',
  'goodsCertifiedAs',
  'bcp',
  'consignor',
  'consignee',
  'exportCountry',
  'importCountry'
]
const lineFields = [
  'cnCode',
  'originCountry',
  'netWeight',
  'pieces',
  'packages',
  'packageType'
]

// A select given a value it doesn't offer selects nothing, so fall back to its first option. That
// is how a blank CHED, which has no values, picks up the form's defaults.
function setField(field, value) {
  field.value = value
  if (field.tagName === 'SELECT' && field.selectedIndex === -1) {
    field.selectedIndex = 0
  }
}

function readJson(id) {
  const island = id && document.getElementById(id)
  return island ? JSON.parse(island.textContent) : undefined
}

// The CHED form, used to create and to edit. It fills itself from a control model (the loaded
// CHED, or the start chosen on the create page) and builds the control model back by laying its
// values over that same model. Until it has a model its fields stay disabled.
export class ChedForm {
  constructor(form) {
    this.form = form
    this.lines = form.querySelector('[data-ched-form-lines]')
    this.lineTemplate = form.querySelector('[data-ched-form-line]')
    this.request = form.querySelector('[data-ched-form-request]')
    this.lineCount = 0

    this.body = form.querySelector('[data-ched-form-body]')
    this.prompt = form.querySelector('[data-ched-form-prompt]')

    this.starts = readJson(form.dataset.starts) ?? {}
    this.picker = document.getElementById(form.dataset.startPicker)
    this.picker?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-start]')
      if (button) this.start(button.dataset.start)
    })
    this.picker?.addEventListener('change', (event) => {
      if (event.target.value) this.start(event.target.value)
    })

    form
      .querySelector('[data-ched-form-add]')
      ?.addEventListener('click', () => {
        this.addLine()
        this.showRequest()
      })
    this.lines.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-ched-form-remove]')
      if (remove) {
        remove.closest('tr').remove()
        this.showRequest()
      }
    })
    form.addEventListener('input', () => this.showRequest())
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.submit()
    })

    const model = readJson(form.dataset.model)
    if (model) this.load(model)
  }

  // Shows which start is in use: the pressed button, or the scenario in the select.
  start(id) {
    for (const button of this.picker.querySelectorAll('[data-start]')) {
      button.setAttribute('aria-pressed', String(button.dataset.start === id))
    }
    const select = this.picker.querySelector('select')
    const isScenario = [...select.options].some((option) => option.value === id)
    select.value = isScenario ? id : ''

    this.load(this.starts[id])
  }

  load(model) {
    this.base = model
    this.body.disabled = false
    this.prompt?.remove()
    const values = fromModel(this.base)

    for (const name of fields) {
      setField(this.form.elements[name], values[name])
    }
    this.lines.replaceChildren()
    values.lines.forEach((line) => this.addLine(line))
    this.showRequest()
  }

  addLine(values = {}) {
    const index = this.lineCount++
    const row = document.createElement('tbody')
    row.innerHTML = this.lineTemplate.innerHTML.replaceAll('__INDEX__', index)
    const line = row.firstElementChild

    for (const name of lineFields) {
      setField(
        line.querySelector(`[data-line-field="${name}"]`),
        values[name] ?? ''
      )
    }
    this.lines.append(line)
  }

  values() {
    const values = Object.fromEntries(
      fields.map((name) => [name, this.form.elements[name].value.trim()])
    )
    values.lines = [...this.lines.children].map((row) =>
      Object.fromEntries(
        lineFields.map((name) => [
          name,
          row.querySelector(`[data-line-field="${name}"]`).value.trim()
        ])
      )
    )
    return values
  }

  model() {
    return toModel(this.base, this.values())
  }

  // Sends the model as JSON. The server forwards it to the simulator and passes its answer back.
  async submit() {
    const action = this.form.dataset.action
    if (!action) return

    const button = this.form.querySelector('[data-ched-form-submit]')
    button.disabled = true
    this.showError()

    try {
      const stored = await sendJson(
        action,
        this.form.dataset.method ?? 'POST',
        this.model()
      )
      // Later saves build on what the simulator now holds.
      this.base = stored.certificate
      this.showResult(stored)
    } catch (error) {
      this.showError(error.message)
    } finally {
      button.disabled = false
    }
  }

  // Fills whichever slots the result panel has: the create panel links to the new CHED, the
  // saved panel only shows the response.
  showResult(stored) {
    const result = document.getElementById(this.form.dataset.result)
    if (!result) return

    const id = encodeURIComponent(stored.id)
    const slot = (name) => result.querySelector(`[data-result-${name}]`)
    for (const link of result.querySelectorAll('[data-result-link]')) {
      link.href = `/traces/cheds/${id}`
    }
    if (slot('id')) slot('id').textContent = stored.id
    if (slot('decision')) slot('decision').href = `/traces/cheds/${id}/decision`
    if (slot('poc')) slot('poc').href = `/poc/simulator/ched/${id}`
    if (slot('btms')) {
      slot('btms').href =
        `${result.dataset.btmsPortalUrl}/search-result?searchTerm=${id}`
    }
    slot('response').textContent = JSON.stringify(stored, null, 2)

    result.hidden = false
    result.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Shows the simulator's own message, which names the code or file at fault. No message hides it.
  showError(message) {
    const error = this.form.querySelector('[data-ched-form-error]')
    error.hidden = !message
    if (message) {
      error.querySelector('[data-ched-form-error-detail]').textContent = message
      error.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  showRequest() {
    if (this.request) {
      this.request.textContent = JSON.stringify(this.model(), null, 2)
    }
  }
}
