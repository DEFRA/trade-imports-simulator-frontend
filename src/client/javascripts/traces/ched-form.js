import { fromModel, quantityOf, toModel } from './ched-model.js'
import { sendJson } from '../send-json.js'
import { CommodityPicker } from './commodity-picker.js'
import { loadTree } from './commodity-trees.js'

const fields = [
  'purpose',
  'goodsCertifiedAs',
  'bcp',
  'consignor',
  'consignee',
  'exportCountry',
  'importCountry'
]
const lineFields = ['cnCode', 'originCountry', 'quantity', 'unit']

// A new CHED's arrival at the border control post, which the form doesn't show: this time tomorrow,
// to the minute.
function tomorrow() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  date.setSeconds(0, 0)
  return date.toISOString()
}

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
// values over that same model. On the create page it waits, hidden, for a start to be chosen.
export class ChedForm {
  constructor(form) {
    this.form = form
    this.lines = form.querySelector('[data-ched-form-lines]')
    this.lineTemplate = form.querySelector('[data-ched-form-line]')
    this.lineCount = 0
    this.pickers = new Map()

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
      ?.addEventListener('click', () => this.addLine())
    this.lines.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-ched-form-remove]')
      if (remove) {
        const line = remove.closest('tr')
        this.pickers.delete(line)
        line.remove()
      }
    })
    form
      .querySelector('[data-scenario-save]')
      ?.addEventListener('click', () => this.saveScenario())
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.submit()
    })

    const model = readJson(form.dataset.model)
    if (model) this.load(model)
  }

  // Step 1 to step 2: fills the form from the chosen start, then swaps the picker for the form.
  start(id) {
    const model = structuredClone(this.starts[id])
    model.specifiedConsignment ??= {}
    model.specifiedConsignment.availabilityDueDateTime ??= tomorrow()
    this.load(model)

    this.picker.hidden = true
    document.getElementById(this.form.dataset.step).hidden = false
  }

  load(model) {
    this.base = model
    this.quantity = quantityOf(model)
    const values = fromModel(this.base)

    this.form.querySelector('[data-ched-form-quantity-heading]').textContent =
      this.quantity.heading

    for (const name of fields) {
      setField(this.form.elements[name], values[name])
    }
    // Before the lines, so they don't pick up the last start's tree.
    this.loadCommodities(this.base.exchangedDocument?.includedNote?.CHED_TYPE)
    this.lines.replaceChildren()
    this.pickers.clear()
    values.lines.forEach((line) => this.addLine(line))
    // A CHED needs a commodity, so one without a line starts with an empty one.
    if (!values.lines.length) this.addLine()
  }

  // The CN code pickers search the CHED type's commodity tree, which loads while the form is in
  // use. Lines added before it arrives get it here; lines added after get it in addLine.
  async loadCommodities(chedType) {
    this.chedType = chedType
    this.tree = undefined
    if (!chedType) return
    try {
      const tree = await loadTree(chedType)
      // A start of another type may have been chosen while this tree was on its way.
      if (this.chedType !== chedType) return
      this.tree = tree
      for (const picker of this.pickers.values()) picker.setTree(tree)
    } catch (error) {
      this.showError(`The commodity tree didn't load: ${error.message}`)
    }
  }

  addLine(values = {}) {
    const index = this.lineCount++
    const row = document.createElement('tbody')
    row.innerHTML = this.lineTemplate.innerHTML.replaceAll('__INDEX__', index)
    const line = row.firstElementChild

    // The units on offer depend on the CHED type, so they're filled in here, not in the template.
    const unit = line.querySelector('[data-line-field="unit"]')
    for (const { code, text } of this.quantity.units) {
      const option = document.createElement('option')
      option.value = code
      option.textContent = text
      unit.append(option)
    }

    const picker = new CommodityPicker(
      line.querySelector('[data-commodity-picker]')
    )
    if (this.tree) picker.setTree(this.tree)
    picker.setValue(values.cnCode ?? '')
    this.pickers.set(line, picker)

    for (const name of lineFields.filter((field) => field !== 'cnCode')) {
      setField(
        line.querySelector(`[data-line-field="${name}"]`),
        values[name] || (name === 'unit' ? this.quantity.defaultUnit : '')
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

    // The stub would build a certificate with an unclassified commodity, so stop it here.
    if (this.values().lines.some((line) => !line.cnCode)) {
      this.showError('Every commodity line needs a CN code.')
      return
    }

    const button = this.form.querySelector('[data-ched-form-submit]')
    button.disabled = true
    this.showError()

    try {
      const stored = await sendJson(
        action,
        this.form.dataset.method ?? 'POST',
        this.model()
      )
      const done = this.form.dataset.done
      if (done) {
        window.location.assign(
          done.replace('{id}', encodeURIComponent(stored.id))
        )
        return
      }
      // Later saves build on what the simulator now holds.
      this.base = stored.certificate
      this.showResult()
    } catch (error) {
      this.showError(error.message)
    } finally {
      button.disabled = false
    }
  }

  // Saves the form as a scenario in the stub, under an ID made from its name. The arrival time is
  // left out so the scenario sets it to tomorrow whenever it's used, rather than to a date that has
  // passed.
  async saveScenario() {
    const status = this.form.querySelector('[data-scenario-status]')
    const name = this.form.querySelector('[data-scenario-name]').value.trim()
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    if (!id) {
      status.textContent = 'Give the scenario a name.'
      return
    }
    if (this.values().lines.some((line) => !line.cnCode)) {
      status.textContent = 'Every commodity line needs a CN code.'
      return
    }

    const model = this.model()
    delete model.specifiedConsignment?.availabilityDueDateTime
    try {
      const saved = await sendJson(
        `${this.form.dataset.scenarioAction}/${id}`,
        'PUT',
        { name, model }
      )
      status.textContent = `Saved scenario "${saved.name}".`
    } catch (error) {
      status.textContent = `Not saved: ${error.message}`
    }
  }

  showResult() {
    const result = document.getElementById(this.form.dataset.result)
    if (!result) return
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
}
