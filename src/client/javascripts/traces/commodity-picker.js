import accessibleAutocomplete from 'accessible-autocomplete'

import { flatten, search } from './commodity-index.js'

// Every picker on a page shares its CHED type's tree, so each tree is indexed once.
const indexes = new WeakMap()

function indexOf(tree) {
  let index = indexes.get(tree)
  if (!index) {
    const entries = flatten(tree)
    index = {
      entries,
      byCode: new Map(entries.map((entry) => [entry.code, entry]))
    }
    indexes.set(tree, index)
  }
  return index
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function entryText(entry) {
  return `${entry.code} – ${entry.description}`
}

function entryHtml(entry) {
  const path = entry.path.length
    ? `<span class="app-commodity-option__path">${escapeHtml(entry.path.join(' › '))}</span>`
    : ''
  return (
    `<span class="app-commodity-option__code">${escapeHtml(entry.code)}</span> ` +
    `<span class="app-commodity-option__description">${escapeHtml(entry.description)}</span>${path}`
  )
}

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function selectButton({ code, description }) {
  const button = element(
    'button',
    'app-button app-button--secondary app-commodity-tree__select',
    'Select'
  )
  button.type = 'button'
  button.dataset.browserSelect = code
  button.setAttribute('aria-label', `Select ${code} ${description}`)
  return button
}

// A commodity line's CN code: an autocomplete over the CHED type's commodity tree, plus a Browse
// dialog. The chosen code lives in the hidden input, which is what ChedForm reads.
export class CommodityPicker {
  constructor(root) {
    this.root = root
    this.slot = root.querySelector('[data-commodity-picker-input]')
    this.hidden = root.querySelector('[data-commodity-picker-value]')
    this.browse = root.querySelector('[data-commodity-picker-browse]')
    this.code = this.hidden.value

    this.browse.addEventListener('click', () => browser().open(this))
    // The autocomplete only confirms options, so emptying the text is caught here.
    this.slot.addEventListener('input', (event) => {
      if (!event.target.value.trim()) this.choose('')
    })
    this.render()
  }

  // The tree can arrive after setValue, which then showed the bare code: show it in full now.
  setTree(tree) {
    this.tree = tree
    this.browse.disabled = false
    if (!this.slot.contains(document.activeElement)) this.render()
  }

  setValue(code) {
    this.code = code ?? ''
    this.hidden.value = this.code
    this.render()
  }

  entry() {
    return this.tree && indexOf(this.tree).byCode.get(this.code)
  }

  text() {
    const entry = this.entry()
    return entry ? entryText(entry) : this.code
  }

  input() {
    return this.slot.querySelector('.autocomplete__input')
  }

  // A user's choice: unlike setValue, it tells the form, which rebuilds its request preview.
  choose(code) {
    if (code === this.code) return
    this.code = code
    this.hidden.value = code
    this.hidden.dispatchEvent(new Event('input', { bubbles: true }))
    this.root.classList.toggle('app-commodity-picker--unknown', false)
  }

  // From the Browse dialog: the autocomplete has to be rebuilt to show the new text.
  pick(code) {
    this.choose(code)
    this.render()
    this.input().focus()
  }

  // accessible-autocomplete has no way to set its text, so showing a value means building it
  // afresh, with the text as its default.
  render() {
    this.root.classList.toggle(
      'app-commodity-picker--unknown',
      Boolean(this.tree && this.code && !this.entry())
    )
    this.slot.replaceChildren()
    accessibleAutocomplete({
      element: this.slot,
      id: this.slot.dataset.id,
      name: '',
      defaultValue: this.text(),
      autoselect: true,
      displayMenu: 'overlay',
      minLength: 1,
      source: (query, populate) =>
        populate(this.tree ? search(indexOf(this.tree).entries, query) : []),
      // Until the first search, the autocomplete's only option is the default text, a string.
      templates: {
        inputValue: (entry) =>
          typeof entry === 'object' ? entryText(entry) : (entry ?? ''),
        suggestion: (entry) =>
          typeof entry === 'object' ? entryHtml(entry) : escapeHtml(entry ?? '')
      },
      tNoResults: () =>
        this.tree ? 'No commodities found' : 'Loading commodities…',
      onConfirm: (entry) => this.confirm(entry)
    })
  }

  // Leaving the field without choosing confirms nothing. Empty text clears the code; anything
  // else typed goes back to showing the code already chosen. It waits for the autocomplete to
  // finish its own blur handling first.
  confirm(entry) {
    if (typeof entry === 'object') {
      this.choose(entry.code)
      return
    }
    setTimeout(() => {
      const text = this.input()?.value.trim()
      if (!text) {
        this.choose('')
      } else if (text !== this.text()) {
        this.render()
      }
    })
  }
}

let sharedBrowser

function browser() {
  sharedBrowser ??= new CommodityBrowser()
  return sharedBrowser
}

// The Browse dialog, shared by every picker on the page. The tree starts with its chapters
// collapsed and builds a node's children only when it's first expanded: CHED-D has ~5,000 nodes.
class CommodityBrowser {
  constructor() {
    this.dialog = element('dialog', 'app-commodity-browser')
    this.dialog.setAttribute('aria-labelledby', 'commodity-browser-title')
    this.dialog.innerHTML = `
      <div class="app-commodity-browser__header">
        <h2 class="app-commodity-browser__title" id="commodity-browser-title">Choose a commodity</h2>
        <div class="app-field">
          <label class="app-field__label" for="commodity-browser-filter">Filter by code or description</label>
          <input class="app-input" id="commodity-browser-filter" type="text" autocomplete="off" spellcheck="false">
        </div>
      </div>
      <div class="app-commodity-browser__body">
        <p class="app-commodity-browser__status" role="status"></p>
        <ul class="app-commodity-tree"></ul>
        <ul class="app-commodity-browser__results" hidden></ul>
      </div>
      <div class="app-commodity-browser__footer">
        <button type="button" class="app-button app-button--secondary" data-browser-cancel>Cancel</button>
      </div>`
    this.filterInput = this.dialog.querySelector('input')
    this.status = this.dialog.querySelector('[role="status"]')
    this.treeList = this.dialog.querySelector('.app-commodity-tree')
    this.results = this.dialog.querySelector('.app-commodity-browser__results')
    this.nodes = new WeakMap()

    this.dialog.addEventListener('click', (event) => {
      const toggle = event.target.closest('[aria-expanded]')
      const select = event.target.closest('[data-browser-select]')
      if (toggle) this.toggle(toggle)
      if (select) this.select(select.dataset.browserSelect)
      if (event.target.closest('[data-browser-cancel]')) this.dialog.close()
    })
    this.filterInput.addEventListener('input', () => this.filter())
    // Enter in the filter takes the first match, as the autocomplete does.
    this.filterInput.addEventListener('keydown', (event) => {
      const first = this.results.querySelector('[data-browser-select]')
      if (event.key === 'Enter' && !this.results.hidden && first) {
        event.preventDefault()
        this.select(first.dataset.browserSelect)
      }
    })
    document.body.append(this.dialog)
  }

  open(picker) {
    this.picker = picker
    if (picker.tree !== this.tree) {
      this.tree = picker.tree
      this.treeList.replaceChildren(...this.tree.map((node) => this.node(node)))
    }
    this.filterInput.value = ''
    this.filter()
    this.dialog.showModal()
    this.filterInput.focus()
  }

  // Closing first hands focus back to Browse; the picker then takes it for its own input.
  select(code) {
    this.dialog.close()
    this.picker.pick(code)
  }

  node(node) {
    const [code, description, pickable, children] = node
    const item = element(
      'li',
      code ? 'app-commodity-tree__node' : 'app-commodity-tree__node--label'
    )
    const row = element('div', 'app-commodity-tree__row')
    const name = element(
      children.length ? 'button' : 'span',
      children.length
        ? 'app-commodity-tree__toggle'
        : 'app-commodity-tree__leaf'
    )
    if (children.length) {
      name.type = 'button'
      name.setAttribute('aria-expanded', 'false')
    }
    if (code) {
      name.append(element('span', 'app-commodity-option__code', code), ' ')
    }
    name.append(description)
    row.append(name)
    if (pickable) row.append(selectButton({ code, description }))
    item.append(row)
    this.nodes.set(item, node)
    return item
  }

  toggle(button) {
    const item = button.closest('li')
    const expand = button.getAttribute('aria-expanded') !== 'true'
    button.setAttribute('aria-expanded', String(expand))

    let list = item.querySelector(':scope > ul')
    if (expand && !list) {
      list = element('ul')
      list.append(...this.nodes.get(item)[3].map((node) => this.node(node)))
      item.append(list)
    }
    if (list) list.hidden = !expand
  }

  filter() {
    const query = this.filterInput.value
    const limit = 50
    const matches = query.trim()
      ? search(indexOf(this.tree).entries, query, limit)
      : undefined

    this.treeList.hidden = Boolean(matches)
    this.results.hidden = !matches
    if (!matches) {
      this.status.textContent = ''
      return
    }

    this.status.textContent = matches.length
      ? `${matches.length === limit ? `First ${limit}` : matches.length} matches`
      : 'No matches'
    this.results.replaceChildren(
      ...matches.map((entry) => {
        const item = element('li', 'app-commodity-browser__result')
        const text = element('span', 'app-commodity-browser__result-text')
        text.innerHTML = entryHtml(entry)
        item.append(text, selectButton(entry))
        return item
      })
    )
  }
}
