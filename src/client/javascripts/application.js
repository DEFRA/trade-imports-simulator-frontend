import { ChedForm } from './traces/ched-form.js'
import { DecisionForm } from './traces/decision-form.js'

// Behaviour is attached by data-module, as govuk-frontend's createAll does.
const modules = {
  'app-ched-form': (element) => new ChedForm(element),
  'app-decision-form': (element) => new DecisionForm(element)
}

for (const element of document.querySelectorAll('[data-module]')) {
  modules[element.dataset.module]?.(element)
}
