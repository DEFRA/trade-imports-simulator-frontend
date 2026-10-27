import { isEnabled, simulators } from '#/server/common/helpers/simulators.js'

export const homeController = {
  handler(_request, h) {
    return h.view('home/index', {
      pageTitle: 'Simulators',
      heading: 'Simulators',
      simulators: simulators.map((simulator) => ({
        ...simulator,
        enabled: isEnabled(simulator)
      }))
    })
  }
}
