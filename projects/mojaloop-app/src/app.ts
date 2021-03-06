import { pipeline, RuleConfig } from '@interledger/rafiki'
import { Rule, setPipelineReader } from './types/rule'
import { PeerInfo } from './types/peer'
import hapi from 'hapi'
import { MojaloopHttpEndpoint } from './endpoints/mojaloop/mojaloop-http'
import { MojaloopHttpEndpointManager } from './endpoints/mojaloop/mojaloop-http-server'
import { MojaloopHttpRequest, MojaloopHttpReply, isTransferPostMessage, isQuotePostMessage, isTransferPutErrorRequest, isTransferPutMessage, isQuotePutMessage, isQuotePutErrorRequest, isTransferGetRequest, isQuoteGetRequest } from './types/mojaloop-packets'
import { log } from './winston'
import { Router as RoutingTable, RouteManager } from 'ilp-routing'
import { TrackRequestsRule, RequestMapEntry } from './rules/track-requests-rule'
import { Money } from './types/mojaloop-models/money'
import { ForeignExchangeRule } from './rules/fx-rule'
import { v4 as uuid } from 'uuid'

const logger = log.child({ component: 'app' })

export interface AppOptions {
  mojaAddress?: string,
  port?: number
}
export class App {
  routingTable: RoutingTable = new RoutingTable()
  routeManager: RouteManager = new RouteManager(this.routingTable)
  private outgoingToIncomingTransferMap: Map<string, string> = new Map()
  private _outgoingTransferPostRequestEntryMap: Map<string, RequestMapEntry> = new Map()
  private _incomingTransferPostRequestEntryMap: Map<string, RequestMapEntry> = new Map()
  private _transferPutRequestEntryMap: Map<string, RequestMapEntry> = new Map()
  private _transferErrorRequestEntryMap: Map<string, RequestMapEntry> = new Map()
  private _quotePostRequestEntryMap: Map<string, RequestMapEntry> = new Map()
  private _quotePutRequestEntryMap: Map<string, RequestMapEntry> = new Map()
  private _quoteErrorRequestEntryMap: Map<string, RequestMapEntry> = new Map()
  private _businessRulesMap: Map<string, Rule[]> = new Map()
  private _mojaAddress: string
  private _mojaId: string = 'fxp' // fspId of fxp
  private _port: number
  private _httpServer: hapi.Server
  private _httpEndpointManager: MojaloopHttpEndpointManager
  private _outgoingRequestHandlers: Map<string, (request: MojaloopHttpRequest) => Promise<MojaloopHttpReply>> = new Map()
  private _peerInfoMap: Map<string, PeerInfo> = new Map()

  constructor (opts?: AppOptions) {
    this._mojaAddress = opts && opts.mojaAddress || 'unknown'
    this._port = opts && opts.port || 3000
    this._httpServer = new hapi.Server({
      host: '0.0.0.0',
      port: this._port
    })

    this._httpServer.route({
      method: 'GET',
      path: '/health',
      handler: function (request: hapi.Request,reply: hapi.ResponseToolkit) {
        return 'status: ok'
      }
    })

    // logging to see the path of every request
    this._httpServer.events.on('response', function (request: hapi.Request) {
      logger.info('INCOMING ' + request.info.remoteAddress + ': ' + request.method.toUpperCase() + ' ' + request.path)
    })

    this._httpEndpointManager = new MojaloopHttpEndpointManager(this._httpServer, { getStoredTransferById: this.getStoredTransferPostById.bind(this), getStoredQuoteById: this.getStoredQuotePostById.bind(this), getStoredQuotePutById: this.getStoredQuotePutById.bind(this), mapOutgoingTransferToIncoming: this.mapOutgoingTransferToIncoming.bind(this) })
  }

  public async start (): Promise<void> {
    logger.info('Starting app http server on port=' + this._port)
    await this._httpServer.start()
  }

  public async shutdown (): Promise<void> {
    logger.info('Stopping app http server')
    await this._httpServer.stop()
  }

  public async addPeer (peerInfo: PeerInfo, endpoint?: MojaloopHttpEndpoint) {
    logger.info('adding new peer: ' + peerInfo.id, { peerInfo })
    this._peerInfoMap.set(peerInfo.id, peerInfo)
    this.routeManager.addPeer(peerInfo.id, peerInfo.relation)
    // TODO: assuming will have address for this peer.
    this.routeManager.addRoute({
      peer: peerInfo.id,
      prefix: peerInfo.mojaAddress,
      path: []
    })
    const rulesInstances: Rule[] = this._createRules(peerInfo)
    this._businessRulesMap.set(peerInfo.id, rulesInstances)
    const endpointInstance = endpoint || new MojaloopHttpEndpoint({ url: peerInfo.url })
    this._httpEndpointManager.set(peerInfo.id, endpointInstance)

    const sendOutgoingRequest = (request: MojaloopHttpRequest): Promise<MojaloopHttpReply> => {
      try {
        return endpointInstance.sendOutgoingRequest(request)
      } catch (e) {

        e.message = 'failed to send packet: ' + e.message

        throw e
      }
    }

    // create incoming and outgoing pipelines for business rules
    const combinedRules = pipeline(...rulesInstances)
    const sendIncoming = rulesInstances.length > 0 ? setPipelineReader('incoming', combinedRules, this.sendOutgoingRequest.bind(this)) : this.sendOutgoingRequest.bind(this)
    const sendOutgoing = rulesInstances.length > 0 ? setPipelineReader('outgoing', combinedRules, sendOutgoingRequest) : sendOutgoingRequest
    endpointInstance.setIncomingRequestHandler((request: MojaloopHttpRequest) => {
      return sendIncoming(request)
    })
    this._outgoingRequestHandlers.set(peerInfo.id, sendOutgoing)

    rulesInstances.forEach(rule => rule.startup())
  }

  public async removePeer (id: string) {
    logger.info('Removing peer:' + id)
    Array.from(this.getRules(id)).forEach(rule => rule.shutdown())
    this._businessRulesMap.delete(id)
    this._httpEndpointManager.delete(id)
    this._peerInfoMap.delete(id)
    this._outgoingRequestHandlers.delete(id)
  }

  public setMojaAddress (address: string) {
    logger.info('Setting address:' + address)
    this._mojaAddress = address
  }

  public getOwnAddress (): string {
    return this._mojaAddress
  }

  public getRules (peerId: string): Rule[] {
    return this._businessRulesMap.get(peerId) || []
  }

  public getPeers (): { [peerId: string]: PeerInfo } {
    let peers: { [peerId: string]: PeerInfo } = {}

    this._peerInfoMap.forEach(peerInfo => peers[peerInfo.id] = peerInfo)

    return peers
  }

  public getPeerEndpoint (peerId: string): MojaloopHttpEndpoint {
    const endpoint = this._httpEndpointManager.get(peerId)
    if (!endpoint) {
      throw new Error(`No endpoint found for peerId=${peerId}`)
    }
    return endpoint
  }

  public async sendOutgoingRequest (request: MojaloopHttpRequest): Promise<MojaloopHttpReply> {
    let destination = ''
    let nextHop = ''
    let outgoingRequest: MojaloopHttpRequest = request
    outgoingRequest.headers = this._updateRequestHeaders(outgoingRequest, nextHop)
    if (isQuotePostMessage(request.body)) {
      destination = request.body.payee.partyIdInfo.partySubIdOrType || ''
      nextHop = this.routingTable.nextHop(destination)
    } else if (isQuotePutMessage(request.body)) {
      const storedQuote = this.getStoredQuotePostById(request.objectId!) // TODO: update typing so that don't have to assert objectId is not undefined
      nextHop = storedQuote.sourcePeerId
      request.body.transferDestination = this._mojaId
    } else if (isTransferPostMessage(request.body)) {
      const storedQuotePutRequest = this.getStoredQuotePutById(request.body.quoteId)
      nextHop = storedQuotePutRequest.sourcePeerId

      // create new transfer
      const newTransferId = uuid()
      let newTransferPostRequest: MojaloopHttpRequest = {
        headers: request.headers,
        body: {
          transferId: newTransferId,
          quoteId: request.body.quoteId,
          payerFsp: this._mojaId,
          payeeFsp: storedQuotePutRequest.body.transferDestination,
          amount: request.body.amount, // take the amount from the request as the fx-rule will update it in the outgoing pipeline
          ilpPacket: request.body.ilpPacket,
          condition: request.body.condition,
          expiration: request.body.expiration,
          extensionList: request.body.extensionList
        }
      }
      outgoingRequest = newTransferPostRequest
      this.outgoingToIncomingTransferMap.set(newTransferId, request.body.transferId)
    } else if (isTransferPutMessage(request.body)) {
      const storedTransferPostRequest = this.mapOutgoingTransferToIncoming(request.objectId!) // TODO: update typing so that don't have to assert objectId is not undefined
      nextHop = storedTransferPostRequest.sourcePeerId
      outgoingRequest.objectId = storedTransferPostRequest.body.transferId
    }
    const handler = this._outgoingRequestHandlers.get(nextHop)

    if (!handler) {
      logger.error('Handler not found for specified nextHop=', nextHop)
      throw new Error(`No handler set for ${nextHop}`)
    }

    logger.debug('sending outgoing Packet', { destination, nextHop, headers: outgoingRequest.headers })

    return handler(outgoingRequest)
  }

  private _updateRequestHeaders (request: MojaloopHttpRequest, nextHop: string) {
    let newHeaders = { 'date': new Date(request.headers['date']).toUTCString() }

    if (isQuotePutErrorRequest(request) || isTransferPutErrorRequest(request) || isTransferGetRequest(request) || isQuoteGetRequest(request)) { // TODO: update headers
      newHeaders = Object.assign(newHeaders, { 'fspiop-source': this._mojaId, 'fspiop-destination': 'test' })
    } else if (isQuotePostMessage(request.body)) {
      newHeaders = Object.assign(newHeaders, { 'fspiop-source': this._mojaId, 'content-type': 'application/vnd.interoperability.quotes+json;version=1.0', 'accept': 'application/vnd.interoperability.quotes+json;version=1.0' })
    } else if (isTransferPostMessage(request.body)) {
      const storedQuotePutRequest = this.getStoredQuotePutById(request.body.quoteId)
      newHeaders = Object.assign(newHeaders, { 'fspiop-source': this._mojaId, 'fspiop-destination': storedQuotePutRequest.body.transferDestination, 'content-type': 'application/vnd.interoperability.transfers+json;version=1.0', 'accept': 'application/vnd.interoperability.transfers+json;version=1.0' })
    } else if (isTransferPutMessage(request.body)) {
      const requestEntry = this.mapOutgoingTransferToIncoming(request.objectId || '')
      if (!requestEntry) {
        logger.error('No transfer post request received for quoteId=' + request.objectId, { request })
        throw new Error('No transfer post request received for quoteId=' + request.objectId)
      }
      newHeaders = Object.assign(newHeaders, { 'fspiop-source': this._mojaId, 'fspiop-destination': requestEntry.headers['fspiop-source'], 'content-type': 'application/vnd.interoperability.transfers+json;version=1.0', 'accept': 'application/vnd.interoperability.transfers+json;version=1.0' })
    } else if (isQuotePutMessage(request.body)) {
      const requestEntry = this._quotePostRequestEntryMap.get(request.objectId || '')
      if (!requestEntry) {
        logger.error('No quote post request received for quoteId=' + request.objectId, { request })
        throw new Error('No quote post request received for quoteId=' + request.objectId)
      }
      newHeaders = Object.assign(newHeaders, { 'fspiop-source': this._mojaId, 'fspiop-destination': requestEntry.headers['fspiop-source'], 'content-type': 'application/vnd.interoperability.quotes+json;version=1.0', 'accept': 'application/vnd.interoperability.quotes+json;version=1.0' })
    }

    logger.info('Updated headers', { oldHeaders: request.headers, newHeaders })

    return newHeaders
  }

  public getPeerInfo (id: string): PeerInfo {
    const peerInfo = this._peerInfoMap.get(id)
    if (!peerInfo) {
      logger.error('No peer information found for peerId=', id)
      throw new Error(`No peer information found for ${id}`)
    }
    return peerInfo
  }

  getPeerRules (id: string): Rule[] {
    return this._businessRulesMap.get(id) || []
  }

  private _createRules (peerInfo: PeerInfo): Rule[] {

    const appRules: RuleConfig[] = [
      { name: 'track-requests' }
    ]

    // conversion function for the foregin exchange rule.
    const convertAmount = (incomingAmount: Money, quoteId?: string): Money => {
      const usdToXofExchangeRate = 579.59
      if (incomingAmount.currency === peerInfo.assetCode) {
        return incomingAmount
      } else if (incomingAmount.currency.toLowerCase() === 'usd' && peerInfo.assetCode.toLowerCase() === 'xof') { // usd -> xof
        return {
          amount: (Number(incomingAmount.amount) * usdToXofExchangeRate).toString(),
          currency: 'XOF'
        }
      } else if (incomingAmount.currency.toLowerCase() === 'xof' && peerInfo.assetCode.toLowerCase() === 'usd') { // xof -> usd
        return {
          amount: (Number(incomingAmount.amount) / usdToXofExchangeRate).toString(),
          currency: 'USD'
        }
      } else {
        logger.error('Exchange rule can only convert from USD <-> XOF.', { incomingCurrency: incomingAmount.currency, peerCurrency: peerInfo.assetCode })
        throw new Error(`Exchange rule can only convert from USD <-> XOF. incoming currency=${incomingAmount.currency}, peer currency=${peerInfo.assetCode}`)
      }
    }

    const instantiateRule = (rule: RuleConfig): Rule => {
      switch (rule.name) {
        case('track-requests'):
          return new TrackRequestsRule({
            quoteErrorRequestEntryMap: this._quoteErrorRequestEntryMap,
            quotePostRequestEntryMap: this._quotePostRequestEntryMap,
            quotePutRequestEntryMap: this._quotePutRequestEntryMap,
            transferErrorRequestEntryMap: this._transferErrorRequestEntryMap,
            transferPostRequestEntryMap: this._incomingTransferPostRequestEntryMap,
            transferPutRequestEntryMap: this._transferPutRequestEntryMap,
            peerId: peerInfo.id
          })
        case('foreign-exchange'):
          return new ForeignExchangeRule({ convertAmount })
        default:
          logger.error(`Rule ${rule.name} is not supported`, { peerInfo })
          throw new Error(`Rule ${rule.name} undefined`)
      }
    }

    return [...appRules, ...peerInfo.rules].map(instantiateRule)
  }

  getStoredTransferPostById (id: string): RequestMapEntry {
    const transfer = this._incomingTransferPostRequestEntryMap.get(id)
    if (!transfer) {
      throw new Error('No transfer post request found for transferId=' + id)
    }
    return transfer
  }

  getStoredQuotePostById (id: string): RequestMapEntry {
    const quote = this._quotePostRequestEntryMap.get(id)
    if (!quote) {
      throw new Error('No quote post request found for quoteId=' + id)
    }
    return quote
  }

  getStoredQuotePutById (id: string): RequestMapEntry {
    const quote = this._quotePutRequestEntryMap.get(id)
    if (!quote) {
      throw new Error('No quote put request found for quoteId=' + id)
    }
    return quote
  }

  mapOutgoingTransferToIncoming (id: string): RequestMapEntry {
    const incomingTransferId = this.outgoingToIncomingTransferMap.get(id)

    if (!incomingTransferId) {
      throw new Error('No incoming post transfer request found for outgoing transfer post with id=' + id)
    }

    return this.getStoredTransferPostById(incomingTransferId)
  }

}
