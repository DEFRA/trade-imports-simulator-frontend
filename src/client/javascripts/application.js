import { ChedForm } from './traces/ched-form.js'
import { DecisionForm } from './traces/decision-form.js'
import { DeclarationForm } from './cds/declaration-form.js'
import { FinalisationForm } from './cds/finalisation-form.js'
import { NotificationForm } from './fis/notification-form.js'

// Behaviour is attached by data-module, as govuk-frontend's createAll does.
const modules = {
  'app-ched-form': (element) => new ChedForm(element),
  'app-decision-form': (element) => new DecisionForm(element),
  'app-cds-declaration-form': (element) => new DeclarationForm(element),
  'app-cds-finalisation-form': (element) => new FinalisationForm(element),
  'app-iuu-notification-form': (element) => new NotificationForm(element)
}

for (const element of document.querySelectorAll('[data-module]')) {
  modules[element.dataset.module]?.(element)
}
