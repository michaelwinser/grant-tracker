/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateShortcutRequest = {
    /**
     * ID of the file to create a shortcut to
     */
    targetId: string;
    /**
     * Folder to create the shortcut in
     */
    parentId: string;
    /**
     * Optional shortcut name (defaults to target's name)
     */
    name?: string;
};

