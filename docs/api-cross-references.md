# Adorn API Cross-References and Relationships

**NOTE:** This document has been reorganized into a dedicated subfolder. Please refer to the new structure for detailed information.

## New Structure

The cross-references documentation has been moved to [`docs/cross-references/`](./cross-references/) directory with the following organization:

- [`docs/cross-references/index.md`](./cross-references/index.md) - Main entry point with overview
- [`docs/cross-references/core-api-relationships.md`](./cross-references/core-api-relationships.md) - Core API relationships
- [`docs/cross-references/decorator-route-relationships.md`](./cross-references/decorator-route-relationships.md) - Decorator and route relationships
- [`docs/cross-references/response-reply-relationships.md`](./cross-references/response-reply-relationships.md) - Response and reply relationships
- [`docs/cross-references/error-handling-relationships.md`](./cross-references/error-handling-relationships.md) - Error handling relationships
- [`docs/cross-references/validation-schema-relationships.md`](./cross-references/validation-schema-relationships.md) - Validation and schema relationships
- [`docs/cross-references/openapi-documentation-relationships.md`](./cross-references/openapi-documentation-relationships.md) - OpenAPI and documentation relationships
- [`docs/cross-references/integration-api-relationships.md`](./cross-references/integration-api-relationships.md) - Integration API relationships

## What's New

The content has been reorganized into focused sections that provide:

1. **Better navigation** - Each major topic has its own dedicated file
2. **Improved readability** - Smaller, more focused documents
3. **Enhanced cross-linking** - Better integration with other documentation
4. **Modular structure** - Easier to maintain and update individual sections

## Quick Links

- [Core API Relationships](./cross-references/core-api-relationships.md) - Route definition, registration, and request processing
- [Decorator and Route Relationships](./cross-references/decorator-route-relationships.md) - Decorator hierarchy and configuration inheritance
- [Response and Reply Relationships](./cross-references/response-reply-relationships.md) - Response types and building patterns
- [Error Handling Relationships](./cross-references/error-handling-relationships.md) - Error types and handling flow
- [Validation and Schema Relationships](./cross-references/validation-schema-relationships.md) - Schema types and validation integration
- [OpenAPI and Documentation Relationships](./cross-references/openapi-documentation-relationships.md) - OpenAPI generation and documentation sources
- [Integration API Relationships](./cross-references/integration-api-relationships.md) - Metal-ORM and Express integration

## Benefits of the New Structure

Understanding these relationships helps developers:

1. **Navigate the codebase** more effectively
2. **Understand component interactions** and dependencies
3. **Design better integrations** with the framework
4. **Debug issues** by following the data flow
5. **Extend the framework** with new features

The relationships shown here demonstrate the well-designed architecture of Adorn API, where components are loosely coupled but work together seamlessly to provide a powerful API development experience.