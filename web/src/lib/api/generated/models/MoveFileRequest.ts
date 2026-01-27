/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MoveFileRequest = {
    /**
     * ID of the file to move
     */
    fileId: string;
    /**
     * ID of the new parent folder
     */
    newParentId: string;
    /**
     * ID of the previous parent folder (optional, will be detected if not provided)
     */
    prevParentId?: string;
};

