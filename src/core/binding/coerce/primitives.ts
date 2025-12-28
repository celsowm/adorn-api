/**
 * Coercion modes for automatic type conversion.
 *
 * Controls how primitive values are automatically converted
 * during parameter binding.
 *
 * - `'none'` - No coercion; values remain as provided
 * - `'smart'` - Intelligent type inference from string values
 */
export type CoerceMode = 'none' | 'smart';

/**
 * Pattern for valid numeric strings.
 * Matches integers and decimals with optional negative sign.
 * Rejects leading zeros to preserve string IDs (e.g., '007').
 */
const NUMERIC_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/**
 * Smart coercion for primitive values.
 *
 * Automatically converts string values to appropriate primitive types:
 *
 * | Input                      | Output              |
 * |----------------------------|---------------------|
 * | `'null'`                   | `null`              |
 * | `'true'` / `'false'`       | `boolean`           |
 * | `'42'`, `'3.14'`, `'-10'`  | `number`            |
 * | Other strings              | `string` (trimmed)  |
 *
 * @param value - Value to coerce
 * @returns Coerced primitive value
 *
 * @remarks
 * - Whitespace is trimmed before type detection
 * - Non-string values pass through unchanged
 * - Leading zeros preserve string type (`'007'` → `'007'`)
 * - Special values (`Infinity`, `NaN`) are not coerced
 *
 * @example
 * ```typescript
 * // Boolean coercion
 * coercePrimitiveSmart('true');   // → true
 * coercePrimitiveSmart('false');  // → false
 *
 * // Numeric coercion
 * coercePrimitiveSmart('42');     // → 42
 * coercePrimitiveSmart('3.14');   // → 3.14
 * coercePrimitiveSmart('-10');    // → -10
 *
 * // Null coercion
 * coercePrimitiveSmart('null');   // → null
 *
 * // String handling
 * coercePrimitiveSmart('  hello  '); // → 'hello'
 * coercePrimitiveSmart('007');       // → '007' (preserved)
 *
 * // Non-string pass-through
 * coercePrimitiveSmart(42);   // → 42
 * coercePrimitiveSmart(null); // → null
 * ```
 */
export function coercePrimitiveSmart(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  // Special literal values
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Numeric conversion (excludes leading zeros and special values)
  if (trimmed !== '' && NUMERIC_RE.test(trimmed)) {
    const num = Number(trimmed);
    if (Number.isFinite(num)) {
      return num;
    }
  }

  return trimmed;
}

/**
 * Coerce a value based on the specified mode.
 *
 * @param value - Value to coerce
 * @param mode - Coercion mode to apply
 * @returns Coerced value (or original if mode is 'none')
 *
 * @example
 * ```typescript
 * coercePrimitive('42', 'smart'); // → 42
 * coercePrimitive('42', 'none');  // → '42'
 * ```
 */
export function coercePrimitive(value: unknown, mode: CoerceMode): unknown {
  return mode === 'smart' ? coercePrimitiveSmart(value) : value;
}