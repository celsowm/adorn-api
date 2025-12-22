// src/lib/decorators.ts
// Context metadata symbol for standard decorators
const META_KEY = Symbol('adorn:route');
const STATUS_META = Symbol('adorn:status');
export const SCHEMA_META = Symbol('adorn:schema');
export const AUTH_META = Symbol('adorn:auth');
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
