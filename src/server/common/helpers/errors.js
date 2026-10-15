import { statusCodes } from '../constants/status-codes.js'
import { ControlApiError } from '../clients/certificate-control.js'

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

  // The stub refused or couldn't be reached. Its message names what to fix, so show it.
  const fromSimulator = response instanceof ControlApiError
  const statusCode = fromSimulator
    ? statusCodes.badGateway
    : response.output.statusCode
  const errorMessage = fromSimulator
    ? `The TRACES simulator: ${response.message}`
    : statusCodeMessage(statusCode)

  if (statusCode >= statusCodes.internalServerError) {
    request.logger.error(response?.stack)
  }

  return h
    .view('error/index', {
      pageTitle: errorMessage,
      heading: statusCode,
      message: errorMessage
    })
    .code(statusCode)
}
