import { config } from '#/config/config.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

// The POC's pages for the simulator target, served through this app: users see its CHED views (the
// XSLT, kept as it is) without needing the CDP developer key, which is added here. Only the
// simulator target, so nothing here can reach real EU acceptance. Its pages link relatively, so
// they work under /poc unchanged.
const simulatorPath = /^simulator\//

// The quantity console is the one page that writes: it reserves, cancels and clears a declaration's
// customs quantities.
const writablePath =
  /^simulator\/ched\/[^/]+\/declarations\/[^/]+\/(reservation|clearance)$/

const forwardedRequestHeaders = ['accept', 'content-type', 'x-customs-office']
const forwardedResponseHeaders = [
  'content-type',
  'content-disposition',
  'location',
  'cache-control'
]

export const poc = {
  plugin: {
    name: 'poc',
    register(server) {
      // The POC's pages carry their own inline styles and scripts, and its console posts JSON
      // without a crumb. Writes are limited in the handler instead.
      const plugins = { blankie: false, crumb: false }

      server.route([
        {
          method: 'GET',
          path: '/poc/{path*}',
          options: { plugins },
          handler: proxy
        },
        {
          method: ['POST', 'PUT', 'DELETE'],
          path: '/poc/{path*}',
          options: { plugins, payload: { parse: false, output: 'data' } },
          handler: proxy
        }
      ])
    }
  }
}

async function proxy(request, h) {
  const path = request.params.path ?? ''
  const isWrite = request.method !== 'get'

  if (!simulatorPath.test(path) || (isWrite && !writablePath.test(path))) {
    return h
      .response('Not available through this app.')
      .code(statusCodes.notFound)
  }
  // The key is added here, so a page on another site mustn't be able to write through us.
  if (isWrite && request.headers['sec-fetch-site'] === 'cross-site') {
    return h
      .response('Cross-site writes are refused.')
      .code(statusCodes.forbidden)
  }

  const headers = Object.fromEntries(
    forwardedRequestHeaders
      .filter((name) => request.headers[name])
      .map((name) => [name, request.headers[name]])
  )
  // A browser asks for text/html first but also lists application/xml, and the POC checks for XML
  // first, so a page load would come back as raw XML. Ask for the page the browser wants.
  if (headers.accept?.startsWith('text/html')) headers.accept = 'text/html'

  const apiKey = config.get('tracesPoc.apiKey')
  if (apiKey) headers['x-api-key'] = apiKey

  const baseUrl = config.get('tracesPoc.baseUrl')
  let response
  try {
    response = await fetch(`${baseUrl}/${path}${request.url.search}`, {
      method: request.method.toUpperCase(),
      headers,
      body: isWrite && request.payload?.length ? request.payload : undefined,
      redirect: 'manual'
    })
  } catch (error) {
    return h
      .response(
        `Could not reach the POC at ${baseUrl}: ${error.cause?.code ?? error.message}`
      )
      .code(statusCodes.badGateway)
  }

  const reply = h
    .response(Buffer.from(await response.arrayBuffer()))
    .code(response.status)
  for (const name of forwardedResponseHeaders) {
    const value = response.headers.get(name)
    if (value) reply.header(name, value)
  }
  return reply
}
