import {
  applyCombination,
  checkFields,
  documentFields,
  forAmend,
  forCreate,
  forScenario,
  followDispatch,
  fromModel,
  headerFields,
  itemFields,
  newDocument,
  newItem,
  toModel
} from './declaration-model.js'
import { sendJson } from '../send-json.js'
import { onStartChosen, readJson, saveScenario } from '../form-starts.js'
import { CommodityPicker } from '../commodities/commodity-picker.js'
import { loadTree } from '../commodities/load-tree.js'

// A new declaration's arrival, unless its start says otherwise: this time tomorrow, to the minute.
function tomorrow() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  date.setSeconds(0, 0)
  return date.getTime()
}

// A select given a value it doesn't offer selects nothing. A request being amended or a scenario
// may hold a code the list lacks (a country code CDS still uses, say), and the form mustn't drop
// it, so it's added as an option of its own. With no value, the select falls back to its first.
function setField(field, value) {
  field.value = value
  if (field.tagName === 'SELECT' && field.selectedIndex === -1) {
    if (value) {
      const option = document.createElement('option')
      option.value = option.textContent = value
      field.append(option)
      field.value = value
    } else {
      field.selectedIndex = 0
    }
  }
}

const valuesOf = (root, attribute, names) =>
  Object.fromEntries(
    names.map((name) => [
      name,
      root.querySelector(`[${attribute}="${name}"]`).value.trim()
    ])
  )

// The clearance request form, used to create a declaration and to amend one. It fills itself from a
// request (the start chosen on the create page, or the version being amended) and builds the request
// back by laying its values over that same request. Items hold their own checks and documents.
export class DeclarationForm {
  constructor(form) {
    this.form = form
    this.items = form.querySelector('[data-cds-items]')
    this.itemTemplate = form.querySelector('[data-cds-item]')
    this.checkTemplate = form.querySelector('[data-cds-check]')
    this.documentTemplate = form.querySelector('[data-cds-document]')
    this.lookups = readJson(form.dataset.lookups)
    this.itemCount = 0
    this.checkCount = 0
    this.documentCount = 0
    this.pickers = new Map()

    // Amending: the MRN is fixed and the request goes out as the version after this one.
    this.mrn = form.dataset.mrn
    this.version = Number(form.dataset.version)

    this.starts = readJson(form.dataset.starts) ?? {}
    this.picker = document.getElementById(form.dataset.startPicker)
    onStartChosen(this.picker, (id) => this.start(id))

    form
      .querySelector('[data-cds-item-add]')
      .addEventListener('click', () => this.addItem())
    this.items.addEventListener('click', (event) => this.onItemClick(event))
    this.items.addEventListener('input', (event) => this.onItemInput(event))
    form.elements.dispatchCountryCode.addEventListener('change', () =>
      this.onDispatchChange()
    )
    form
      .querySelector('[data-scenario-save]')
      ?.addEventListener('click', () => this.saveScenario())
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.submit()
    })

    this.loadCommodities()
    const model = readJson(form.dataset.model)
    if (model) this.load(model)
  }

  // Step 1 to step 2: fills the form from the chosen start, then swaps the picker for the form.
  start(id) {
    const model = structuredClone(this.starts[id])
    model.header ??= {}
    model.header.arrivalDateTime ??= tomorrow()
    this.load(model)

    this.picker.hidden = true
    document.getElementById(this.form.dataset.step).hidden = false
  }

  load(model) {
    this.base = model
    const values = fromModel(model)
    for (const name of headerFields) {
      setField(this.form.elements[name], values[name])
    }
    this.dispatch = values.dispatchCountryCode
    this.items.replaceChildren()
    this.pickers.clear()
    values.items.forEach((item) => this.addItem(item))
    // A declaration needs an item, so one without starts with an empty one.
    if (!values.items.length) this.addItem()
  }

  // One tree, the UK tariff, for every item. Items added before it arrives get it here; items added
  // after get it in addItem.
  async loadCommodities() {
    try {
      this.tree = await loadTree(this.form.dataset.commodities)
      for (const picker of this.pickers.values()) picker.setTree(this.tree)
    } catch (error) {
      this.showError(`The commodity codes didn't load: ${error.message}`)
    }
  }

  // With no values it's a new item, whose goods come from the dispatch country until changed. It
  // starts with the commonest checks and documents, so only the commodity and references need filling.
  addItem(
    values = {
      ...newItem,
      itemOriginCountryCode: this.dispatch,
      ...applyCombination(
        { documents: [] },
        this.lookups.combinations[0],
        this.lookups.departments
      )
    }
  ) {
    const index = this.itemCount++
    const holder = document.createElement('div')
    holder.innerHTML = this.itemTemplate.innerHTML.replaceAll('__ITEM__', index)
    const item = holder.firstElementChild
    item.dataset.index = index

    const picker = new CommodityPicker(
      item.querySelector('[data-commodity-picker]')
    )
    if (this.tree) picker.setTree(this.tree)
    picker.setValue(values.taricCommodityCode ?? '')
    this.pickers.set(item, picker)

    for (const name of itemFields.filter((n) => n !== 'taricCommodityCode')) {
      setField(
        item.querySelector(`[data-item-field="${name}"]`),
        values[name] ?? ''
      )
    }
    this.setLines(item, values)

    this.items.append(item)
    this.renumber()
  }

  // Replaces an item's checks and documents.
  setLines(item, { checks = [], documents = [] }) {
    item.querySelector('[data-cds-checks]').replaceChildren()
    item.querySelector('[data-cds-documents]').replaceChildren()
    for (const values of checks) this.addCheck(item, values)
    for (const values of documents) this.addDocument(item, values)
  }

  // A new check is the first code on the list, in its department.
  addCheck(item, values) {
    const row = this.addLine(item, {
      template: this.checkTemplate,
      placeholder: '__CHECK__',
      index: this.checkCount++,
      body: '[data-cds-checks]',
      attribute: 'data-check-field',
      fields: checkFields,
      values: values ?? {}
    })
    if (!values) this.followCheckCode(row)
  }

  addDocument(item, values = newDocument) {
    this.addLine(item, {
      template: this.documentTemplate,
      placeholder: '__DOC__',
      index: this.documentCount++,
      body: '[data-cds-documents]',
      attribute: 'data-document-field',
      fields: documentFields,
      values
    })
  }

  addLine(
    item,
    { template, placeholder, index, body, attribute, fields, values }
  ) {
    const holder = document.createElement('tbody')
    holder.innerHTML = template.innerHTML
      .replaceAll('__ITEM__', item.dataset.index)
      .replaceAll(placeholder, index)
    const row = holder.firstElementChild
    for (const name of fields) {
      setField(
        row.querySelector(`[${attribute}="${name}"]`),
        values[name] ?? ''
      )
    }
    item.querySelector(body).append(row)
    return row
  }

  // A check's department follows its code: each code belongs to one.
  followCheckCode(row) {
    const code = row.querySelector('[data-check-field="checkCode"]').value
    row.querySelector('[data-check-field="departmentCode"]').value =
      this.lookups.departments[code] ?? ''
  }

  // The combination select is an action, not a field: it sets the lines, then goes back to its prompt.
  onCombination(item, select) {
    const combination = this.lookups.combinations[select.value]
    select.value = ''
    if (!combination) return
    this.setLines(
      item,
      applyCombination(
        this.itemValues(item),
        combination,
        this.lookups.departments
      )
    )
  }

  onItemClick(event) {
    const item = event.target.closest('.app-cds-item')
    if (event.target.closest('[data-cds-check-add]')) {
      this.addCheck(item)
    } else if (event.target.closest('[data-cds-document-add]')) {
      this.addDocument(item)
    } else if (
      event.target.closest(
        '[data-cds-check-remove], [data-cds-document-remove]'
      )
    ) {
      event.target.closest('tr').remove()
    } else if (event.target.closest('[data-cds-item-remove]')) {
      this.pickers.delete(item)
      item.remove()
      this.renumber()
    }
  }

  onItemInput(event) {
    const item = event.target.closest('.app-cds-item')
    if (event.target.matches('[data-cds-combination]')) {
      this.onCombination(item, event.target)
    } else if (event.target.matches('[data-check-field="checkCode"]')) {
      this.followCheckCode(event.target.closest('tr'))
    }
  }

  // Items whose origin still follows the dispatch country move with it; others keep theirs.
  onDispatchChange() {
    const dispatch = this.form.elements.dispatchCountryCode.value
    for (const origin of this.items.querySelectorAll(
      '[data-item-field="itemOriginCountryCode"]'
    )) {
      setField(origin, followDispatch(origin.value, this.dispatch, dispatch))
    }
    this.dispatch = dispatch
  }

  // Items are numbered in the order shown, as the request numbers them.
  renumber() {
    let number = 0
    for (const item of this.items.children) {
      item.querySelector('[data-cds-item-number]').textContent = ++number
    }
  }

  values() {
    const values = Object.fromEntries(
      headerFields.map((name) => [name, this.form.elements[name].value.trim()])
    )
    values.items = [...this.items.children].map((item) => this.itemValues(item))
    return values
  }

  itemValues(item) {
    return {
      ...valuesOf(item, 'data-item-field', itemFields),
      goodsDescription: this.pickers.get(item)?.entry()?.description,
      checks: [...item.querySelectorAll('[data-cds-checks] tr')].map((row) =>
        valuesOf(row, 'data-check-field', checkFields)
      ),
      documents: [...item.querySelectorAll('[data-cds-documents] tr')].map(
        (row) => valuesOf(row, 'data-document-field', documentFields)
      )
    }
  }

  model() {
    return toModel(this.base, this.values())
  }

  // The request as it's sent: a new declaration, or the next version of the one being amended.
  request() {
    return this.mrn
      ? forAmend(this.model(), this.mrn, this.version)
      : forCreate(this.model())
  }

  // BTMS can't match an item without a commodity code, so stop it here.
  missingCode() {
    return this.values().items.some((item) => !item.taricCommodityCode)
  }

  async submit() {
    if (this.missingCode()) {
      this.showError('Every item needs a commodity code.')
      return
    }

    const button = this.form.querySelector('[data-cds-form-submit]')
    button.disabled = true
    this.showError()

    try {
      const stored = await sendJson(
        this.form.dataset.action,
        'POST',
        this.request()
      )
      this.showResult(stored)
      // An amendment is sent once: the next one starts from this version, so reload to make it.
      if (this.mrn) return
    } catch (error) {
      this.showError(this.mrn ? amendMessage(error) : error.message)
    }
    button.disabled = false
  }

  saveScenario() {
    return saveScenario(this.form, {
      problem: () =>
        this.missingCode() ? 'Every item needs a commodity code.' : undefined,
      model: () => forScenario(this.model())
    })
  }

  showResult({ mrn, entryVersionNumber }) {
    const result = document.getElementById(this.form.dataset.result)
    result.querySelector('[data-result-mrn]').textContent = mrn
    result.querySelector('[data-result-version]').textContent =
      entryVersionNumber
    const declaration = `/cds/declarations/${encodeURIComponent(mrn)}`
    result.querySelector('[data-result-view]').href = declaration
    result.querySelector('[data-result-amend]').href = `${declaration}/amend`
    const btms = result.querySelector('[data-result-btms]')
    btms.href = `${btms.dataset.btmsPortal}/search-result?searchTerm=${encodeURIComponent(mrn)}`
    result.hidden = false
    result.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Shows the simulator's own message, which names what's wrong. No message hides it.
  showError(message) {
    const error = this.form.querySelector('[data-cds-form-error]')
    error.hidden = !message
    if (message) {
      error.querySelector('[data-cds-form-error-detail]').textContent = message
      error.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}

// The simulator refuses a version it already has (409): someone amended the declaration since this
// page loaded. The fix is to start again from the version now latest, not to guess the next number.
function amendMessage(error) {
  return error.status === 409
    ? `${error.message}. It has been amended since this page loaded: reload to start from the latest version.`
    : error.message
}
