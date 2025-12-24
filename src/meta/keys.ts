/**
 * Symbol keys for storing metadata on classes and methods
 * Uses the standard Stage 3 decorator metadata API
 */

// Controller metadata
export const CONTROLLER_KEY = Symbol('adorn:controller');

// Route metadata
export const ROUTE_KEY = Symbol('adorn:route');

// Status code metadata
export const STATUS_KEY = Symbol('adorn:status');

// Parameter metadata
export const PARAM_KEY = Symbol('adorn:param');

// DTO property metadata
export const DTO_PROPERTY_KEY = Symbol('adorn:dto:property');

// Security metadata
export const SECURITY_KEY = Symbol('adorn:security');
