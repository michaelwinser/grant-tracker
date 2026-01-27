/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Config } from '../models/Config';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ConfigService {
    /**
     * Get application configuration
     * Returns client configuration including OAuth client ID and service account status
     * @returns Config Configuration data
     * @throws ApiError
     */
    public static getConfig(): CancelablePromise<Config> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/config',
        });
    }
}
