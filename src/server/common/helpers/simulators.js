import { config } from '#/config/config.js'

// One entry per upstream system this app stands in for. Each can be switched off per environment,
// for example TRACES where the stub points at real EU acceptance.
export const simulators = [
  {
    text: 'TRACES',
    href: '/traces',
    description:
      'Create, update, accept and reject CHEDs in the TRACES NT simulator.',
    // /poc serves the POC's views of the same stub's CHEDs.
    paths: ['/traces', '/poc'],
    enabledKey: 'tracesSimulator.enabled'
  },
  {
    text: 'CDS',
    href: '/cds',
    description:
      'Create and amend customs declarations, sent to BTMS through the CDS simulator.',
    paths: ['/cds'],
    enabledKey: 'cdsSimulator.enabled'
  }
]

export function isEnabled(simulator) {
  return config.get(simulator.enabledKey)
}

export function enabledSimulators() {
  return simulators.filter(isEnabled)
}
