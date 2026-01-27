/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ShortcutDetails } from './ShortcutDetails';
export type FileInfo = {
    /**
     * File ID
     */
    id: string;
    /**
     * File name
     */
    name: string;
    /**
     * MIME type
     */
    mimeType: string;
    /**
     * Last modified timestamp
     */
    modifiedTime?: string;
    /**
     * URL to view the file in browser
     */
    webViewLink?: string;
    shortcutDetails?: ShortcutDetails;
};

