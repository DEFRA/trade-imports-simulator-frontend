import { statusCodes } from '../constants/status-codes.js'
import { ControlApiError } from '../clients/json-api.js'

function statusCodeMessage(statusCode) {
  switch (statusCode) {
    case statusCodes.notFound:
      return 'Page not found'
    case statusCodes.forbidden:
      return 'Forbidden'
    case statusCodes.unauthorized:
      return 'Unauthorized'
    case statusCodes.badRequest:
      return 'Bad Request'
    default:
      return 'Something went wrong'
  }
}

export function catchAll(request, h) {
  const { response } = request

  // JSON routes (tagged api) answer errors in JSON, not with the HTML error page.
  if (
    !('isBoom' in response) ||
    request.route?.settings.tags?.includes('api')
  ) {
    return h.continue
  }

  // A simulator refused or couldn't be reached. Its message names what to fix, so show it. A record
  // the simulator lacks is this app's 404 too.
  const fromSimulator = response instanceof ControlApiError
  const simulatorStatus =
    response.status === statusCodes.notFound
      ? statusCodes.notFound
      : statusCodes.badGateway
  const statusCode = fromSimulator
    ? simulatorStatus
    : response.output.statusCode
  const errorMessage = fromSimulator
    ? `The ${response.service}: ${response.message}`
    : statusCodeMessage(statusCode)

  // The call to the simulator that failed, so the page and log say what to reproduce.
  const failedRequest = fromSimulator ? describeRequest(response.request) : {}

  if (statusCode >= statusCodes.internalServerError) {
    request.logger.error(response?.stack)
    if (failedRequest.failedRequest) {
      request.logger.error(
        `${response.service} request failed: ${failedRequest.failedRequest}${failedRequest.failedRequestBody ? ` ${failedRequest.failedRequestBody}` : ''}`
      )
    }
  }

  return h
    .view('error/index', {
      pageTitle: errorMessage,
      heading: statusCode,
      message: errorMessage,
      ...failedRequest
    })
    .code(statusCode)
}

function describeRequest(sent) {
  if (!sent?.url) return {}
  return {
    failedRequest: `${sent.method} ${sent.url}`,
    ...(sent.body ? { failedRequestBody: prettyBody(sent.body) } : {})
  }
}

function prettyBody(body) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return String(body)
  }
}
