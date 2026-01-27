/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AppendRowRequest } from '../models/AppendRowRequest';
import type { BatchUpdateRequest } from '../models/BatchUpdateRequest';
import type { DeleteRowRequest } from '../models/DeleteRowRequest';
import type { ReadSheetRequest } from '../models/ReadSheetRequest';
import type { ReadSheetResponse } from '../models/ReadSheetResponse';
import type { SuccessResponse } from '../models/SuccessResponse';
import type { UpdateRowRequest } from '../models/UpdateRowRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SheetsService {
    /**
     * Read data from a sheet
     * Reads all data from a sheet, returning headers and rows separately
     * @returns ReadSheetResponse Sheet data
     * @throws ApiError
     */
    public static readSheet({
        requestBody,
    }: {
        requestBody: ReadSheetRequest,
    }): CancelablePromise<ReadSheetResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/sheets/read',
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
     * Append a row to a sheet
     * Appends a new row to the end of a sheet
     * @returns SuccessResponse Row appended successfully
     * @throws ApiError
     */
    public static appendRow({
        requestBody,
    }: {
        requestBody: AppendRowRequest,
    }): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/sheets/append',
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
     * Update a row in a sheet
     * Updates fields in a row identified by an ID column value
     * @returns SuccessResponse Row updated successfully
     * @throws ApiError
     */
    public static updateRow({
        requestBody,
    }: {
        requestBody: UpdateRowRequest,
    }): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/sheets/update',
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
    /**
     * Delete a row from a sheet
     * Deletes a row identified by an ID column value
     * @returns SuccessResponse Row deleted successfully
     * @throws ApiError
     */
    public static deleteRow({
        requestBody,
    }: {
        requestBody: DeleteRowRequest,
    }): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/sheets/delete',
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
    /**
     * Batch update multiple cells
     * Updates multiple cells in a single request
     * @returns SuccessResponse Cells updated successfully
     * @throws ApiError
     */
    public static batchUpdateCells({
        requestBody,
    }: {
        requestBody: BatchUpdateRequest,
    }): CancelablePromise<SuccessResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/sheets/batch-update',
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
}
