/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type BatchUpdateRequest = {
    /**
     * Sheet name
     */
    sheet: string;
    updates: Array<{
        /**
         * Cell range (e.g., 'A2:C2')
         */
        range: string;
        /**
         * Values to set in the range
         */
        values: Array<any>;
    }>;
};

