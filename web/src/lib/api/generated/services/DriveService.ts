/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateDocRequest } from '../models/CreateDocRequest';
import type { CreateDocResponse } from '../models/CreateDocResponse';
import type { CreateFolderRequest } from '../models/CreateFolderRequest';
import type { CreateFolderResponse } from '../models/CreateFolderResponse';
import type { CreateShortcutRequest } from '../models/CreateShortcutRequest';
import type { CreateShortcutResponse } from '../models/CreateShortcutResponse';
import type { FileInfo } from '../models/FileInfo';
import type { GetFileRequest } from '../models/GetFileRequest';
import type { ListFilesRequest } from '../models/ListFilesRequest';
import type { ListFilesResponse } from '../models/ListFilesResponse';
import type { MoveFileRequest } from '../models/MoveFileRequest';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DriveService {
    /**
     * List files in a folder
     * Lists all files in a Drive folder
     * @returns ListFilesResponse List of files
     * @throws ApiError
     */
    public static listFiles({
        requestBody,
    }: {
        requestBody: ListFilesRequest,
    }): CancelablePromise<ListFilesResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/drive/list',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Not authenticated`,
                403: `Access denied (no permission to grants folder)`,
                500: `Server error`,
            },
        });
    }
    /**
     * Create a folder
     * Creates a new folder in Google Drive
     * @returns CreateFolderResponse Folder created
     * @throws ApiError
     */
    public static createFolder({
        requestBody,
    }: {
        requestBody: CreateFolderRequest,
    }): CancelablePromise<CreateFolderResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/drive/create-folder',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Not authenticated`,
                403: `Access denied (no permission to grants folder)`,
                500: `Server error`,
            },
        });
    }
    /**
     * Create a document
     * Creates a new Google Doc, Sheet, or other document type
     * @returns CreateDocResponse Document created
     * @throws ApiError
     */
    public static createDoc({
        requestBody,
    }: {
        requestBody: CreateDocRequest,
    }): CancelablePromise<CreateDocResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/drive/create-doc',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Not authenticated`,
                403: `Access denied (no permission to grants folder)`,
                500: `Server error`,
            },
        });
    }
    /**
     * Create a shortcut
     * Creates a shortcut to an existing file
     * @returns CreateShortcutResponse Shortcut created
     * @throws ApiError
     */
    public static createShortcut({
        requestBody,
    }: {
        requestBody: CreateShortcutRequest,
    }): CancelablePromise<CreateShortcutResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/drive/create-shortcut',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Not authenticated`,
                403: `Access denied (no permission to grants folder)`,
                500: `Server error`,
            },
        });
    }
    /**
     * Move a file
     * Moves a file to a different folder
     * @returns SuccessResponse File moved successfully
     * @throws ApiError
     */
    public static moveFile({
        requestBody,
    }: {
        requestBody: MoveFileRequest,
    }): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/drive/move',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Not authenticated`,
                403: `Access denied (no permission to grants folder)`,
                500: `Server error`,
            },
        });
    }
    /**
     * Get file metadata
     * Gets metadata for a specific file
     * @returns FileInfo File metadata
     * @throws ApiError
     */
    public static getFile({
        requestBody,
    }: {
        requestBody: GetFileRequest,
    }): CancelablePromise<FileInfo> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/drive/get',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Not authenticated`,
                403: `Access denied (no permission to grants folder)`,
                404: `Resource not found`,
                500: `Server error`,
            },
        });
    }
}
