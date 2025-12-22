var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
// src/controllers/user.controller.ts
import { Controller, Get, Post, FromQuery, FromPath, FromBody } from "../lib/decorators.js";
// --- DTO Definitions (The substitute for Parameter Decorators) ---
let GetUserRequest = (() => {
    let _userId_decorators;
    let _userId_initializers = [];
    let _userId_extraInitializers = [];
    let _details_decorators;
    let _details_initializers = [];
    let _details_extraInitializers = [];
    return class GetUserRequest {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _userId_decorators = [FromPath()];
            _details_decorators = [FromQuery()];
            __esDecorate(null, null, _userId_decorators, { kind: "field", name: "userId", static: false, private: false, access: { has: obj => "userId" in obj, get: obj => obj.userId, set: (obj, value) => { obj.userId = value; } }, metadata: _metadata }, _userId_initializers, _userId_extraInitializers);
            __esDecorate(null, null, _details_decorators, { kind: "field", name: "details", static: false, private: false, access: { has: obj => "details" in obj, get: obj => obj.details, set: (obj, value) => { obj.details = value; } }, metadata: _metadata }, _details_initializers, _details_extraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        userId = __runInitializers(this, _userId_initializers, void 0);
        details = (__runInitializers(this, _userId_extraInitializers), __runInitializers(this, _details_initializers, void 0));
        constructor() {
            __runInitializers(this, _details_extraInitializers);
        }
    };
})();
export { GetUserRequest };
let CreateUserRequest = (() => {
    let _name_decorators;
    let _name_initializers = [];
    let _name_extraInitializers = [];
    let _email_decorators;
    let _email_initializers = [];
    let _email_extraInitializers = [];
    return class CreateUserRequest {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _name_decorators = [FromBody()];
            _email_decorators = [FromBody()];
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: obj => "name" in obj, get: obj => obj.name, set: (obj, value) => { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: obj => "email" in obj, get: obj => obj.email, set: (obj, value) => { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        name = __runInitializers(this, _name_initializers, void 0);
        email = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _email_initializers, void 0));
        constructor() {
            __runInitializers(this, _email_extraInitializers);
        }
    };
})();
export { CreateUserRequest };
// --- The Controller ---
let UserController = (() => {
    let _classDecorators = [Controller("users")];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _getUser_decorators;
    let _createUser_decorators;
    var UserController = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _getUser_decorators = [Get("/{userId}")];
            _createUser_decorators = [Post("/")];
            __esDecorate(this, null, _getUser_decorators, { kind: "method", name: "getUser", static: false, private: false, access: { has: obj => "getUser" in obj, get: obj => obj.getUser }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _createUser_decorators, { kind: "method", name: "createUser", static: false, private: false, access: { has: obj => "createUser" in obj, get: obj => obj.createUser }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            UserController = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        // Strong typing: 'req' is checked at edit time.
        async getUser(req) {
            return `Getting user ${req.userId} with details: ${req.details}`;
        }
        async createUser(req) {
            console.log(`Creating user ${req.name}`);
        }
        constructor() {
            __runInitializers(this, _instanceExtraInitializers);
        }
    };
    return UserController = _classThis;
})();
export { UserController };
