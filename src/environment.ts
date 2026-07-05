import { RuntimeError } from "./errors.js";
import type { TodValue } from "./values.js";

// ─── Environment (Lexical Scope) ─────────────────────────────────────────────

/**
 * An Environment holds variable bindings for a single lexical scope.
 * Each environment optionally links to a parent scope (its enclosing scope).
 */
export class Environment {
  private readonly values = new Map<string, { value: TodValue; isConst: boolean }>();
  private readonly parent: Environment | null;

  constructor(parent?: Environment) {
    this.parent = parent ?? null;
  }

  /**
   * Define a new variable in the current scope.
   * Shadows any variable with the same name in an outer scope.
   */
  define(name: string, value: TodValue, isConst: boolean = false): void {
    this.values.set(name, { value, isConst });
  }

  /**
   * Look up a variable by name, walking up the scope chain.
   * Throws if the variable is not defined anywhere.
   */
  get(name: string, line?: number): TodValue {
    if (this.values.has(name)) {
      return this.values.get(name)!.value;
    }

    if (this.parent !== null) {
      return this.parent.get(name, line);
    }

    throw new RuntimeError(`Undefined variable '${name}'`, line);
  }

  /**
   * Reassign an existing variable. Walks up the scope chain to find it.
   * Throws if the variable was never declared or is constant.
   */
  set(name: string, value: TodValue, line?: number): void {
    if (this.values.has(name)) {
      const binding = this.values.get(name)!;
      if (binding.isConst) {
        throw new RuntimeError(`Cannot reassign constant variable '${name}'`, line);
      }
      binding.value = value;
      return;
    }

    if (this.parent !== null) {
      this.parent.set(name, value, line);
      return;
    }

    throw new RuntimeError(`Cannot assign to undefined variable '${name}'`, line);
  }
}
