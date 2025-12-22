// src/lib/decorators.ts
// Context metadata symbol for standard decorators
const META_KEY = Symbol('adorn:route');
const STATUS_META = Symbol('adorn:status');
export const SCHEMA_META = Symbol('adorn:schema');
export const AUTH_META = Symbol('adorn:auth');
export const PRODUCES_META = Symbol('adorn:produces');
export const ERRORS_META = Symbol('adorn:errors');
export const TAGS_META = Symbol('adorn:tags');
export const SUMMARY_META = Symbol('adorn:summary');
export const DESCRIPTION_META = Symbol('adorn:description');
// -- Method Decorator --
// Using Standard TC39 Signature
export function Get(path) {
    return function (originalMethod, context) {
        // In standard decorators, we can attach metadata to the class prototype via context
        context.addInitializer(function () {
            const routes = this[META_KEY] || [];
            routes.push({
                method: 'get',
                path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
export function Post(path) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            const routes = this[META_KEY] || [];
            routes.push({
                method: 'post',
                path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
export function Put(path) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            const routes = this[META_KEY] || [];
            routes.push({
                method: 'put',
                path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
export function Delete(path) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            const routes = this[META_KEY] || [];
            routes.push({
                method: 'delete',
                path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
// -- Class Decorator --
export function Controller(basePath) {
    return function (target, context) {
        // We attach the base path to the class constructor
        context.addInitializer(function () {
            this._basePath = basePath;
        });
        return target;
    };
}
// -- DTO Field Decorators --
// Since we can't decorate parameters, we decorate fields in a class
// e.g. class GetUserParams { @FromPath id: string }
export function FromQuery(name) {
    return function (target, context) {
        context.addInitializer(function () {
            const meta = this[SCHEMA_META] || {};
            meta[context.name] = { type: 'query' };
            this[SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
export function FromPath(name) {
    return function (target, context) {
        context.addInitializer(function () {
            const meta = this[SCHEMA_META] || {};
            meta[context.name] = { type: 'path' };
            this[SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
export function FromBody() {
    return function (target, context) {
        context.addInitializer(function () {
            const meta = this[SCHEMA_META] || {};
            meta[context.name] = { type: 'body' };
            this[SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
// -- Status Code Decorator --
export function Status(code) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            this[STATUS_META] = code;
        });
        return originalMethod;
    };
}
// -- Authentication Decorator --
export function Authorized(role) {
    return function (target, context) {
        context.addInitializer(function () {
            this[AUTH_META] = role || 'default';
        });
        return target;
    };
}
// -- Patch HTTP Method --
export function Patch(path) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            const routes = this[META_KEY] || [];
            routes.push({
                method: 'patch',
                path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
// -- Phase 3: Additional DTO Field Decorators --
/**
 * Marks a field to be sourced from request headers
 * @param name - Optional custom header name (defaults to field name)
 */
export function FromHeader(name) {
    return function (target, context) {
        context.addInitializer(function () {
            const meta = this[SCHEMA_META] || {};
            meta[context.name] = { type: 'header', name };
            this[SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
/**
 * Marks a field to be sourced from request cookies
 * @param name - Optional custom cookie name (defaults to field name)
 */
export function FromCookie(name) {
    return function (target, context) {
        context.addInitializer(function () {
            const meta = this[SCHEMA_META] || {};
            meta[context.name] = { type: 'cookie', name };
            this[SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
/**
 * Marks a field to be the Express Request object
 */
export function FromRequest() {
    return function (target, context) {
        context.addInitializer(function () {
            const meta = this[SCHEMA_META] || {};
            meta[context.name] = { type: 'request' };
            this[SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
/**
 * Marks a field for file upload (multipart/form-data)
 * @param fieldName - Field name in the multipart form
 * @param maxCount - Maximum number of files (for array uploads)
 */
export function UploadedFile(fieldName, maxCount) {
    return function (target, context) {
        context.addInitializer(function () {
            const meta = this[SCHEMA_META] || {};
            meta[context.name] = { type: 'file', fieldName, maxCount };
            this[SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
// -- Phase 3: Response Metadata Decorators --
/**
 * Specifies the response content type and description
 * @param mimeType - The MIME type (e.g., 'application/json', 'application/octet-stream')
 * @param description - Optional description for Swagger
 */
export function Produces(mimeType, description) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            this[PRODUCES_META] = { mimeType, description };
        });
        return originalMethod;
    };
}
/**
 * Specifies error responses that can occur
 * @param errors - Array of error responses with status codes and descriptions
 */
export function Errors(errors) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            this[ERRORS_META] = errors;
        });
        return originalMethod;
    };
}
/**
 * Adds tags to the endpoint for Swagger grouping
 * @param tags - Array of tag names
 */
export function Tags(...tags) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            this[TAGS_META] = tags;
        });
        return originalMethod;
    };
}
/**
 * Adds a summary to the endpoint for Swagger
 * @param summary - Short summary of the endpoint
 */
export function Summary(summary) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            this[SUMMARY_META] = summary;
        });
        return originalMethod;
    };
}
/**
 * Adds a description to the endpoint for Swagger
 * @param description - Detailed description of the endpoint
 */
export function Description(description) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            this[DESCRIPTION_META] = description;
        });
        return originalMethod;
    };
}
