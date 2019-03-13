import * as hapi from 'hapi'
import { MojaloopHttpRequest } from '../../../types/mojaloop-packets'
import { ErrorInformationObject } from '../../../types/mojaloop-models/models'
import { MojaloopHttpEndpoint } from '../mojaloop-http'

export function update (request: hapi.Request, reply: hapi.ResponseToolkit) {
  try {
    const endpoint: MojaloopHttpEndpoint = request.server.methods.getEndpoint(request.params.peerId)
    const quoteErrorPutHttpRequest: MojaloopHttpRequest = {
      objectId: request.params.id,
      objectType: 'quote',
      headers: request.headers,
      body: request.payload as ErrorInformationObject
    }

    // Do nothing with response
    const endpointResponse = endpoint.handleIncomingRequest(quoteErrorPutHttpRequest)

    return reply.response().code(202)
  } catch (error) {
    return reply.response().code(500) // TODO: Give generic fail message?
  }
}