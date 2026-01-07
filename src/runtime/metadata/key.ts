/**
 * Symbol key used to store Adorn metadata in class decorator metadata.
 * 
 * @remarks
 * This Symbol.for() call creates a global symbol that is used as the key
 * for storing Adorn-specific metadata in the decorator metadata store.
 * Using Symbol.for() ensures the same symbol is used across different
 * module loads.
 * 
 * @internal
 */
export const ADORN_META = Symbol.for("adorn-api/meta");
