/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateRowRequest = {
    /**
     * Sheet name
     */
    sheet: string;
    /**
     * Column name containing the unique ID
     */
    idColumn: string;
    /**
     * Value of the ID to match
     */
    id: string;
    /**
     * Fields to update as key-value pairs
     */
    data: Record<string, any>;
};

