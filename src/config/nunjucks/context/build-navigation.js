import { enabledSimulators } from '#/server/common/helpers/simulators.js'

export function buildNavigation(request) {
  return enabledSimulators().map(({ text, href }) => ({
    text,
    href,
    current: request?.path?.startsWith(href) ?? false
  }))
}
