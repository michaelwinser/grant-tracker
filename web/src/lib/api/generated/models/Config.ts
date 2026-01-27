/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Config = {
    /**
     * Google OAuth client ID
     */
    clientId: string;
    /**
     * Whether service account API is available
     */
    serviceAccountEnabled: boolean;
    /**
     * ID of the Grant Tracker spreadsheet (only when service account enabled)
     */
    spreadsheetId?: string;
    /**
     * ID of the grants root folder (only when service account enabled)
     */
    grantsFolderId?: string;
};

