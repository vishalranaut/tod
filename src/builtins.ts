import * as fs from "node:fs";
import { Environment } from "./environment.js";
import { RuntimeError } from "./errors.js";
import type { Interpreter } from "./interpreter.js";
import {
  type TodValue,
  type TodBuiltin,
  type TodObject,
  todTypeof,
  todStringify,
  jsToTod,
  todToJs,
  isTodArray,
} from "./values.js";

// ─── Builtin Registration ────────────────────────────────────────────────────

/**
 * Register all built-in functions and namespaces into the global environment.
 */
export function registerBuiltins(env: Environment, interpreter: Interpreter): void {
  // ── Core I/O ──────────────────────────────────────────────────────
  defineBuiltin(env, "log", (...args: TodValue[]) => {
    interpreter.captureLog(...args);
    return null;
  });

  defineBuiltin(env, "print", (...args: TodValue[]) => {
    const line = args.map(todStringify).join(" ");
    process.stdout.write(line);
    return null;
  });

  // ── Type Utilities ────────────────────────────────────────────────
  defineBuiltin(env, "type", (val: TodValue) => {
    return todTypeof(val);
  });

  defineBuiltin(env, "toString", (val: TodValue) => {
    return todStringify(val);
  });

  defineBuiltin(env, "toNumber", (val: TodValue) => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = parseFloat(val);
      if (isNaN(n)) throw new RuntimeError(`Cannot convert '${val}' to number`);
      return n;
    }
    if (typeof val === "boolean") return val ? 1 : 0;
    throw new RuntimeError(`Cannot convert ${todTypeof(val)} to number`);
  });

  defineBuiltin(env, "len", (val: TodValue) => {
    if (typeof val === "string") return val.length;
    if (isTodArray(val)) return val.elements.length;
    throw new RuntimeError(`Cannot get length of ${todTypeof(val)}`);
  });

  // ── Math ──────────────────────────────────────────────────────────
  defineBuiltin(env, "floor", (val: TodValue) => {
    requireType(val, "number", "floor");
    return Math.floor(val as number);
  });

  defineBuiltin(env, "ceil", (val: TodValue) => {
    requireType(val, "number", "ceil");
    return Math.ceil(val as number);
  });

  defineBuiltin(env, "abs", (val: TodValue) => {
    requireType(val, "number", "abs");
    return Math.abs(val as number);
  });

  defineBuiltin(env, "random", () => {
    return Math.random();
  });

  // ── Time ──────────────────────────────────────────────────────────
  defineBuiltin(env, "time", () => {
    return Date.now();
  });

  // ── Process ───────────────────────────────────────────────────────
  defineBuiltin(env, "exit", (code?: TodValue) => {
    const exitCode = typeof code === "number" ? code : 0;
    process.exit(exitCode);
  });

  defineBuiltin(env, "env", (key: TodValue) => {
    requireType(key, "string", "env");
    return process.env[key as string] ?? null;
  });

  // ── JSON Namespace ────────────────────────────────────────────────
  const jsonNs = makeNamespace("json", {
    parse: (str: TodValue) => {
      requireType(str, "string", "json.parse");
      try {
        const parsed: unknown = JSON.parse(str as string);
        return jsToTod(parsed);
      } catch {
        throw new RuntimeError(`json.parse: Invalid JSON string`);
      }
    },
    stringify: (val: TodValue) => {
      const jsVal = todToJs(val);
      return JSON.stringify(jsVal);
    },
  });
  env.define("json", jsonNs);

  // ── File I/O Namespace ────────────────────────────────────────────
  defineBuiltin(env, "readFile", (path: TodValue) => {
    requireType(path, "string", "readFile");
    try {
      return fs.readFileSync(path as string, "utf-8");
    } catch (e) {
      throw new RuntimeError(`readFile: ${(e as Error).message}`);
    }
  });

  defineBuiltin(env, "writeFile", (path: TodValue, data: TodValue) => {
    requireType(path, "string", "writeFile");
    requireType(data, "string", "writeFile");
    try {
      fs.writeFileSync(path as string, data as string, "utf-8");
      return null;
    } catch (e) {
      throw new RuntimeError(`writeFile: ${(e as Error).message}`);
    }
  });

  // ── HTTP Namespace ────────────────────────────────────────────────
  // NOTE: http.get and http.post are async under the hood but we don't
  //       support async in v0. Users should be aware these won't work in
  //       synchronous contexts. We register them as stubs that log a note.
  const httpNs = makeNamespace("http", {
    get: (url: TodValue) => {
      requireType(url, "string", "http.get");
      // Synchronous http is not feasible without top-level await or worker threads.
      // For v0, we'll document this as a limitation.
      throw new RuntimeError(
        `http.get is not available in synchronous mode. Use the CLI with async support (coming in v1).`,
      );
    },
    post: (url: TodValue, _body: TodValue) => {
      requireType(url, "string", "http.post");
      throw new RuntimeError(
        `http.post is not available in synchronous mode. Use the CLI with async support (coming in v1).`,
      );
    },
  });
  env.define("http", httpNs);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defineBuiltin(env: Environment, name: string, fn: (...args: TodValue[]) => TodValue): void {
  const builtin: TodBuiltin = { type: "builtin", name, fn };
  env.define(name, builtin);
}

function makeNamespace(name: string, fns: Record<string, (...args: TodValue[]) => TodValue>): TodObject {
  const properties = new Map<string, TodValue>();
  for (const [fnName, fn] of Object.entries(fns)) {
    const builtin: TodBuiltin = { type: "builtin", name: `${name}.${fnName}`, fn };
    properties.set(fnName, builtin);
  }
  return { type: "object", properties };
}

function requireType(value: TodValue, expected: string, fnName: string): void {
  const actual = todTypeof(value);
  if (actual !== expected) {
    throw new RuntimeError(
      `${fnName} expected ${expected} but got ${actual}`,
    );
  }
}
