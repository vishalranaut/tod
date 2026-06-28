import type { Statement } from "./ast.js";
import type { Environment } from "./environment.js";

// ─── Runtime Value Types ─────────────────────────────────────────────────────

/**
 * A user-defined function (closure).
 */
export interface TodFunction {
  type: "function";
  name: string | null;
  params: string[];
  body: Statement[];
  closure: Environment;
}

/**
 * A built-in (host) function.
 */
export interface TodBuiltin {
  type: "builtin";
  name: string;
  fn: (...args: TodValue[]) => TodValue;
}

/**
 * A key-value object (used for JSON interop and builtin namespaces).
 */
export interface TodObject {
  type: "object";
  properties: Map<string, TodValue>;
}

/**
 * An ordered collection of values.
 */
export interface TodArray {
  type: "array";
  elements: TodValue[];
}

/**
 * Union of all possible runtime values in TOD.
 */
export type TodValue =
  | number
  | string
  | boolean
  | null
  | TodFunction
  | TodBuiltin
  | TodObject
  | TodArray;

// ─── Value Utilities ─────────────────────────────────────────────────────────

/**
 * Check if a value is "truthy" in TOD.
 * `null` and `false` are falsy; everything else is truthy.
 */
export function isTruthy(value: TodValue): boolean {
  if (value === null) return false;
  if (value === false) return false;
  return true;
}

/**
 * Check if a value is a callable (function or builtin).
 */
export function isCallable(value: TodValue): value is TodFunction | TodBuiltin {
  return value !== null && typeof value === "object" && (value.type === "function" || value.type === "builtin");
}

/**
 * Check if a value is a TodObject.
 */
export function isTodObject(value: TodValue): value is TodObject {
  return value !== null && typeof value === "object" && value.type === "object";
}

/**
 * Check if a value is a TodArray.
 */
export function isTodArray(value: TodValue): value is TodArray {
  return value !== null && typeof value === "object" && value.type === "array";
}

/**
 * Get the TOD type name of a value (for the `type()` builtin).
 */
export function todTypeof(value: TodValue): string {
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") {
    if (value.type === "function") return "function";
    if (value.type === "builtin") return "function";
    if (value.type === "object") return "object";
    if (value.type === "array") return "array";
  }
  return "unknown";
}

/**
 * Convert a TOD value to a display string (for `log` and REPL output).
 */
export function todStringify(value: TodValue): string {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    if (value.type === "function") return `<fn ${value.name ?? "anonymous"}>`;
    if (value.type === "builtin") return `<builtin ${value.name}>`;
    if (value.type === "array") {
      const elems = value.elements.map(todStringify).join(", ");
      return `[${elems}]`;
    }
    if (value.type === "object") {
      const entries: string[] = [];
      for (const [k, v] of value.properties) {
        entries.push(`${k}: ${todStringify(v)}`);
      }
      return `{ ${entries.join(", ")} }`;
    }
  }
  return String(value);
}

/**
 * Convert a native JS value (from JSON.parse, etc.) into a TodValue.
 */
export function jsToTod(value: unknown): TodValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return { type: "array", elements: value.map(jsToTod) };
  }
  if (typeof value === "object") {
    const props = new Map<string, TodValue>();
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      props.set(k, jsToTod(v));
    }
    return { type: "object", properties: props };
  }
  return null;
}

/**
 * Convert a TodValue back to a native JS value (for JSON.stringify, etc.).
 */
export function todToJs(value: TodValue): unknown {
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "object") {
    if (value.type === "array") return value.elements.map(todToJs);
    if (value.type === "object") {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.properties) {
        obj[k] = todToJs(v);
      }
      return obj;
    }
  }
  return null;
}
