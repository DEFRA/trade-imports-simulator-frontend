import inert from '@hapi/inert'

import { home } from '../routes/home/index.js'
import { traces } from '../routes/traces/index.js'
import { cds } from '../routes/cds/index.js'
import { fis } from '../routes/fis/index.js'
import { poc } from '../routes/poc/index.js'
import { health } from '../routes/health/index.js'
import { serveStaticFiles } from './serve-static-files.js'
import { config } from '#/config/config.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { isEnabled, simulators } from '#/server/common/helpers/simulators.js'

const simulatorPlugins = { TRACES: [traces, poc], CDS: [cds], FIS: [fis] }

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])
      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])
      // Application specific routes, add your own routes here
      await server.register([home])
      for (const simulator of simulators) {
        await server.register(
          isEnabled(simulator)
            ? simulatorPlugins[simulator.text]
            : disabled(simulator)
        )
      }

      // Static assets
      if (!config.get('isProduction') && !config.get('isTest')) {
        await (async () => {
          const createViteServer = (await import('vite')).createServer
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom'
          })

          await server.register({
            plugin: (await import('@defra/hapi-connect')).default,
            options: {
              path: '/public',
              middleware: [vite.middlewares]
            }
          })
        })()
      } else {
        server.register(serveStaticFiles)
      }
    }
  }
}

// A switched-off simulator's links answer with an error page rather than a bare 404.
function disabled(simulator) {
  return {
    plugin: {
      name: `${simulator.text}-disabled`,
      register(server) {
        server.route(
          simulator.paths.map((path) => ({
            method: '*',
            path: `${path}/{path*}`,
            options: { plugins: { crumb: false } },
            handler(_request, h) {
              const message = `The ${simulator.text} simulator is not enabled in this environment`
              return h
                .view('error/index', {
                  pageTitle: message,
                  heading: statusCodes.notFound,
                  message
                })
                .code(statusCodes.notFound)
            }
          }))
        )
      }
    }
  }
}
