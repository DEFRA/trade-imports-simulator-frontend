import { sendJson } from './send-json.js'

// What the forms share: the JSON islands a page renders, and saving the form as a scenario.

export function readJson(id) {
  const island = id && document.getElementById(id)
  return island ? JSON.parse(island.textContent) : undefined
}

// Saves the form as a scenario in the simulator, under an ID made from its name. `problem` names
// what stops the form being saved, if anything.
export async function saveScenario(form, { problem, model }) {
  const status = form.querySelector('[data-scenario-status]')
  const name = form.querySelector('[data-scenario-name]').value.trim()
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const refusal = id ? problem() : 'Give the scenario a name.'
  if (refusal) {
    status.textContent = refusal
    return
  }
  try {
    const saved = await sendJson(
      `${form.dataset.scenarioAction}/${id}`,
      'PUT',
      { name, model: model() }
    )
    status.textContent = `Saved scenario "${saved.name}".`
  } catch (error) {
    status.textContent = `Not saved: ${error.message}`
  }
}
