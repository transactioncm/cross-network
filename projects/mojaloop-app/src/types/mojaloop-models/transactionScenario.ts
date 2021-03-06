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

/**
 * Below are the allowed values for the enumeration. - DEPOSIT - Used for performing a Cash-In (deposit) transaction. In a normal scenario, electronic funds are transferred from a Business account to a Consumer account, and physical cash is given from the Consumer to the Business User. - WITHDRAWAL - Used for performing a Cash-Out (withdrawal) transaction. In a normal scenario, electronic funds are transferred from a Consumer’s account to a Business account, and physical cash is given from the Business User to the Consumer. - TRANSFER - Used for performing a P2P (Peer to Peer, or Consumer to Consumer) transaction. - PAYMENT - Usually used for performing a transaction from a Consumer to a Merchant or Organization, but could also be for a B2B (Business to Business) payment. The transaction could be online for a purchase in an Internet store, in a physical store where both the Consumer and Business User are present, a bill payment, a donation, and so on. - REFUND - Used for performing a refund of transaction.
 */
export type TransactionScenario = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PAYMENT' | 'REFUND'

export const TransactionScenario = {
  DEPOSIT: 'DEPOSIT' as TransactionScenario,
  WITHDRAWAL: 'WITHDRAWAL' as TransactionScenario,
  TRANSFER: 'TRANSFER' as TransactionScenario,
  PAYMENT: 'PAYMENT' as TransactionScenario,
  REFUND: 'REFUND' as TransactionScenario
}
