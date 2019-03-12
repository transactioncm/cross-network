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
*/import { ExtensionList } from './extensionList'
import { Money } from './money'

/**
 * Data model for the complex type IndividualTransfer.
 */
export interface IndividualTransfer {
    /**
     * Identifies messages related to the same /transfers sequence.
     */
  transferId: string
  transferAmount: Money
    /**
     * ILP Packet containing the amount delivered to the Payee and the ILP Address of the Payee and any other end-to-end data.
     */
  ilpPacket: string
    /**
     * Condition that must be fulfilled to commit the transfer.
     */
  condition: string
  extensionList?: ExtensionList
}
