"use strict";
// src/lib/decorators.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_META = exports.SCHEMA_META = void 0;
exports.Get = Get;
exports.Post = Post;
exports.Put = Put;
exports.Delete = Delete;
exports.Controller = Controller;
exports.FromQuery = FromQuery;
exports.FromPath = FromPath;
exports.FromBody = FromBody;
exports.Authorized = Authorized;
// Context metadata symbol for standard decorators
var META_KEY = Symbol('adorn:route');
exports.SCHEMA_META = Symbol('adorn:schema');
exports.AUTH_META = Symbol('adorn:auth');
// -- Method Decorator --
// Using Standard TC39 Signature
function Get(path) {
    return function (originalMethod, context) {
        // In standard decorators, we can attach metadata to the class prototype via context
        context.addInitializer(function () {
            var routes = this[META_KEY] || [];
            routes.push({
                method: 'get',
                path: path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
function Post(path) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            var routes = this[META_KEY] || [];
            routes.push({
                method: 'post',
                path: path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
function Put(path) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            var routes = this[META_KEY] || [];
            routes.push({
                method: 'put',
                path: path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
function Delete(path) {
    return function (originalMethod, context) {
        context.addInitializer(function () {
            var routes = this[META_KEY] || [];
            routes.push({
                method: 'delete',
                path: path,
                methodName: String(context.name),
            });
            this[META_KEY] = routes;
        });
        return originalMethod;
    };
}
// -- Class Decorator --
function Controller(basePath) {
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
function FromQuery(name) {
    return function (target, context) {
        context.addInitializer(function () {
            var meta = this[exports.SCHEMA_META] || {};
            meta[context.name] = { type: 'query' };
            this[exports.SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
function FromPath(name) {
    return function (target, context) {
        context.addInitializer(function () {
            var meta = this[exports.SCHEMA_META] || {};
            meta[context.name] = { type: 'path' };
            this[exports.SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
function FromBody() {
    return function (target, context) {
        context.addInitializer(function () {
            var meta = this[exports.SCHEMA_META] || {};
            meta[context.name] = { type: 'body' };
            this[exports.SCHEMA_META] = meta;
        });
        return function (initialValue) { return initialValue; };
    };
}
// -- Authentication Decorator --
function Authorized(role) {
    return function (target, context) {
        context.addInitializer(function () {
            this[exports.AUTH_META] = role || 'default';
        });
        return target;
    };
}
