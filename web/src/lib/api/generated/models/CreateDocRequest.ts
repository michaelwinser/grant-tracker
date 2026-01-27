/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateDocRequest = {
    /**
     * Document name
     */
    name: string;
    /**
     * Document type
     */
    mimeType: CreateDocRequest.mimeType;
    /**
     * Parent folder ID
     */
    parentId?: string;
};
export namespace CreateDocRequest {
    /**
     * Document type
     */
    export enum mimeType {
        APPLICATION_VND_GOOGLE_APPS_DOCUMENT = 'application/vnd.google-apps.document',
        APPLICATION_VND_GOOGLE_APPS_SPREADSHEET = 'application/vnd.google-apps.spreadsheet',
        APPLICATION_VND_GOOGLE_APPS_PRESENTATION = 'application/vnd.google-apps.presentation',
    }
}

