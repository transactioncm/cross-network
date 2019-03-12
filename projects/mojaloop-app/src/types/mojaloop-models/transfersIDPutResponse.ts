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
 */import { ExtensionList } from './extensionList';


/**
 * The object sent in the PUT /transfers/{ID} callback.
 */
export interface TransfersIDPutResponse { 
    /**
     * Fulfilment of the condition specified with the transaction. Mandatory if transfer has completed successfully.
     */
    fulfilment?: string;
    /**
     * Time and date when the transaction was completed.
     */
    completedTimestamp?: string;
    /**
     * State of the transfer.
     */
    transferState: string;
    extensionList?: ExtensionList;
}