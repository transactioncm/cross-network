/**
 * Open API for FSP Interoperability (FSPIOP) (Implementation Friendly Version)
 * Based on [API Definition version 1.0](https://github.com/mojaloop/mojaloop-specification/blob/develop/API%20Definition%20v1.0.pdf).  **Note:** The API supports a maximum size of 65536 bytes (64 Kilobytes) in the HTTP header.
 *
 * OpenAPI spec version: 1.0
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { ExtensionList } from './extensionList'
import { GeoCode } from './geoCode'
import { Money } from './money'
import { Party } from './party'
import { TransactionType } from './transactionType'

/**
 * The object sent in the POST /quotes request.
 */
export interface QuotesPostRequest {
    /**
     * Common ID between the FSPs for the quote object, decided by the Payer FSP. The ID should be reused for resends of the same quote for a transaction. A new ID should be generated for each new quote for a transaction.
     */
  quoteId: string
    /**
     * Common ID (decided by the Payer FSP) between the FSPs for the future transaction object. The actual transaction will be created as part of a successful transfer process. The ID should be reused for resends of the same quote for a transaction. A new ID should be generated for each new quote for a transaction.
     */
  transactionId: string
    /**
     * Identifies an optional previously-sent transaction request.
     */
  transactionRequestId?: string
  /**
   * Currency that the transaction should occur in for a specific leg. Needed in the case of fixed RECEIVE.
   */
  transferCurrency: string
  payee: Party
  payer: Party
    /**
     * SEND for send amount, RECEIVE for receive amount.
     */
  amountType: string
  amount: Money
  fees?: Money
  transactionType: TransactionType
  geoCode?: GeoCode
    /**
     * A memo that will be attached to the transaction.
     */
  note?: string
    /**
     * Expiration is optional. It can be set to get a quick failure in case the peer FSP takes too long to respond. Also, it may be beneficial for Consumer, Agent, and Merchant to know that their request has a time limit.
     */
  expiration?: string
  extensionList?: ExtensionList
}
