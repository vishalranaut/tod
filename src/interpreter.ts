import type {
  Program,
  Statement,
  Expression,
} from "./ast.js";
import { RuntimeError, ReturnSignal, BreakSignal, ContinueSignal } from "./errors.js";
import { Environment } from "./environment.js";
import {
  type TodValue,
  type TodFunction,
  isTruthy,
  isCallable,
  isTodObject,
  isTodArray,
  todStringify,
} from "./values.js";
import { registerBuiltins } from "./builtins.js";

// ─── Interpreter ─────────────────────────────────────────────────────────────

export class Interpreter {
  readonly globals: Environment;
  private output: string[] = [];

  constructor() {
    this.globals = new Environment();
    registerBuiltins(this.globals, this);
  }

  /**
   * Execute a full program (list of statements).
   * Returns the value of the last expression statement, or null.
   */
  interpret(program: Program): TodValue {
    let result: TodValue = null;

    for (const stmt of program.body) {
      result = this.execStatement(stmt, this.globals);
    }

    return result;
  }

  /**
   * Collect printed output (used by tests and REPL).
   */
  getOutput(): string[] {
    return this.output;
  }

  clearOutput(): void {
    this.output = [];
  }

  /**
   * Called by the `log` builtin to record output.
   */
  captureLog(...args: TodValue[]): void {
    const line = args.map(todStringify).join(" ");
    this.output.push(line);
    console.log(line);
  }

  // ─── Statement Execution ─────────────────────────────────────────────

  execStatement(stmt: Statement, env: Environment): TodValue {
    switch (stmt.kind) {
      case "LetStatement":
        return this.execLet(stmt, env);
      case "ConstStatement":
        return this.execConst(stmt, env);
      case "FunctionDeclaration":
        return this.execFunctionDecl(stmt, env);
      case "ReturnStatement":
        return this.execReturn(stmt, env);
      case "IfStatement":
        return this.execIf(stmt, env);
      case "WhileStatement":
        return this.execWhile(stmt, env);
      case "ForStatement":
        return this.execFor(stmt, env);
      case "BreakStatement":
        return this.execBreak();
      case "ContinueStatement":
        return this.execContinue();
      case "BlockStatement":
        return this.execBlock(stmt.statements, new Environment(env));
      case "ExpressionStatement":
        return this.evalExpr(stmt.expression, env);
    }
  }

  private execLet(stmt: Extract<Statement, { kind: "LetStatement" }>, env: Environment): TodValue {
    const value = this.evalExpr(stmt.value, env);
    env.define(stmt.name, value);
    return null;
  }

  private execConst(stmt: Extract<Statement, { kind: "ConstStatement" }>, env: Environment): TodValue {
    const value = this.evalExpr(stmt.value, env);
    env.define(stmt.name, value, true); // true for isConst
    return null;
  }

  private execFunctionDecl(stmt: Extract<Statement, { kind: "FunctionDeclaration" }>, env: Environment): TodValue {
    const fn: TodFunction = {
      type: "function",
      name: stmt.name,
      params: stmt.params,
      body: stmt.body,
      closure: env,
    };
    env.define(stmt.name, fn);
    return null;
  }

  private execReturn(stmt: Extract<Statement, { kind: "ReturnStatement" }>, env: Environment): never {
    const value = stmt.value ? this.evalExpr(stmt.value, env) : null;
    throw new ReturnSignal(value);
  }

  private execIf(stmt: Extract<Statement, { kind: "IfStatement" }>, env: Environment): TodValue {
    const condition = this.evalExpr(stmt.condition, env);

    if (isTruthy(condition)) {
      return this.execBlock(stmt.consequence, new Environment(env));
    } else if (stmt.alternative) {
      return this.execBlock(stmt.alternative, new Environment(env));
    }

    return null;
  }

  private execWhile(stmt: Extract<Statement, { kind: "WhileStatement" }>, env: Environment): TodValue {
    let result: TodValue = null;
    let iterations = 0;
    const MAX_ITERATIONS = 1_000_000;

    while (isTruthy(this.evalExpr(stmt.condition, env))) {
      try {
        result = this.execBlock(stmt.body, new Environment(env));
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) {
          // just continue to next iteration
        } else {
          throw e;
        }
      }
      
      iterations++;
      if (iterations >= MAX_ITERATIONS) {
        throw new RuntimeError(
          `Loop exceeded maximum iterations (${MAX_ITERATIONS}). Possible infinite loop.`,
          stmt.line,
        );
      }
    }

    return result;
  }

  private execFor(stmt: Extract<Statement, { kind: "ForStatement" }>, env: Environment): TodValue {
    let result: TodValue = null;
    let iterations = 0;
    const MAX_ITERATIONS = 1_000_000;
    
    // Create scope for initialization
    const forEnv = new Environment(env);
    if (stmt.init) {
      this.execStatement(stmt.init, forEnv);
    }

    while (stmt.condition ? isTruthy(this.evalExpr(stmt.condition, forEnv)) : true) {
      try {
        result = this.execBlock(stmt.body, new Environment(forEnv));
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) {
          // skip body, go to update
        } else {
          throw e;
        }
      }
      
      if (stmt.update) {
        this.evalExpr(stmt.update, forEnv);
      }
      
      iterations++;
      if (iterations >= MAX_ITERATIONS) {
        throw new RuntimeError(
          `Loop exceeded maximum iterations (${MAX_ITERATIONS}). Possible infinite loop.`,
          stmt.line,
        );
      }
    }

    return result;
  }

  private execBreak(): never {
    throw new BreakSignal();
  }

  private execContinue(): never {
    throw new ContinueSignal();
  }

  execBlock(statements: Statement[], env: Environment): TodValue {
    let result: TodValue = null;

    for (const stmt of statements) {
      result = this.execStatement(stmt, env);
    }

    return result;
  }

  // ─── Expression Evaluation ───────────────────────────────────────────

  evalExpr(expr: Expression, env: Environment): TodValue {
    switch (expr.kind) {
      case "NumberLiteral":
        return expr.value;
      case "StringLiteral":
        return expr.value;
      case "BooleanLiteral":
        return expr.value;
      case "NullLiteral":
        return null;
      case "Identifier":
        return env.get(expr.name, expr.line);
      case "AssignExpr":
        return this.evalAssign(expr, env);
      case "CompoundAssignExpr":
        return this.evalCompoundAssign(expr, env);
      case "UpdateExpr":
        return this.evalUpdate(expr, env);
      case "BinaryExpr":
        return this.evalBinary(expr, env);
      case "UnaryExpr":
        return this.evalUnary(expr, env);
      case "CallExpr":
        return this.evalCall(expr, env);
      case "MemberExpr":
        return this.evalMember(expr, env);
      case "IndexExpr":
        return this.evalIndex(expr, env);
      case "ArrayLiteral":
        return this.evalArrayLiteral(expr, env);
      case "ObjectLiteral":
        return this.evalObjectLiteral(expr, env);
      case "TernaryExpr":
        return this.evalTernary(expr, env);
      case "SpreadExpr":
        throw new RuntimeError("Spread operator cannot be used here", expr.line);
      case "FunctionExpr":
        return this.evalFunctionExpr(expr, env);
    }
  }

  private evalAssign(expr: Extract<Expression, { kind: "AssignExpr" }>, env: Environment): TodValue {
    const value = this.evalExpr(expr.value, env);
    env.set(expr.name, value, expr.line);
    return value;
  }

  private evalCompoundAssign(expr: Extract<Expression, { kind: "CompoundAssignExpr" }>, env: Environment): TodValue {
    const current = env.get(expr.name, expr.line);
    const right = this.evalExpr(expr.value, env);
    let newValue: TodValue;

    switch (expr.operator) {
      case "+=":
        if (typeof current === "number" && typeof right === "number") newValue = current + right;
        else if (typeof current === "string" || typeof right === "string") newValue = todStringify(current) + todStringify(right);
        else throw new RuntimeError(`Cannot use '+=' on ${typeof current} and ${typeof right}`, expr.line);
        break;
      case "-=":
        newValue = this.requireNumbers(current, right, "-=", expr.line, (a, b) => a - b);
        break;
      case "*=":
        newValue = this.requireNumbers(current, right, "*=", expr.line, (a, b) => a * b);
        break;
      case "/=":
        if (typeof current === "number" && typeof right === "number") {
          if (right === 0) throw new RuntimeError("Division by zero", expr.line);
          newValue = current / right;
        } else {
          throw new RuntimeError(`Cannot use '/=' on ${typeof current} and ${typeof right}`, expr.line);
        }
        break;
      case "%=":
        if (typeof current === "number" && typeof right === "number") {
          if (right === 0) throw new RuntimeError("Modulo by zero", expr.line);
          newValue = current % right;
        } else {
          throw new RuntimeError(`Cannot use '%=' on ${typeof current} and ${typeof right}`, expr.line);
        }
        break;
      default:
        throw new RuntimeError(`Unknown operator '${expr.operator}'`, expr.line);
    }

    env.set(expr.name, newValue, expr.line);
    return newValue;
  }

  private evalUpdate(expr: Extract<Expression, { kind: "UpdateExpr" }>, env: Environment): TodValue {
    const current = env.get(expr.name, expr.line);
    if (typeof current !== "number") {
      throw new RuntimeError(`Cannot use '${expr.operator}' on non-number`, expr.line);
    }
    
    // Postfix update returns the original value, then updates
    const newValue = expr.operator === "++" ? current + 1 : current - 1;
    env.set(expr.name, newValue, expr.line);
    
    // TOD currently only has postfix ++/--, but if it's evaluated as a statement, returning newValue is fine.
    // In JS, x++ returns the old value. Let's stick to returning old value to be accurate.
    return current;
  }

  private evalBinary(expr: Extract<Expression, { kind: "BinaryExpr" }>, env: Environment): TodValue {
    // Short-circuit for logical operators
    if (expr.operator === "&&") {
      const left = this.evalExpr(expr.left, env);
      if (!isTruthy(left)) return left;
      return this.evalExpr(expr.right, env);
    }
    if (expr.operator === "||") {
      const left = this.evalExpr(expr.left, env);
      if (isTruthy(left)) return left;
      return this.evalExpr(expr.right, env);
    }

    const left = this.evalExpr(expr.left, env);
    const right = this.evalExpr(expr.right, env);

    switch (expr.operator) {
      case "+":
        if (typeof left === "number" && typeof right === "number") return left + right;
        if (typeof left === "string" || typeof right === "string") return todStringify(left) + todStringify(right);
        throw new RuntimeError(`Cannot add ${typeof left} and ${typeof right}`, expr.line);
      case "-":
        return this.requireNumbers(left, right, "-", expr.line, (a, b) => a - b);
      case "*":
        return this.requireNumbers(left, right, "*", expr.line, (a, b) => a * b);
      case "/": {
        const result = this.requireNumbers(left, right, "/", expr.line, (a, b) => a / b);
        if (right === 0) throw new RuntimeError("Division by zero", expr.line);
        return result;
      }
      case "%": {
        const result = this.requireNumbers(left, right, "%", expr.line, (a, b) => a % b);
        if (right === 0) throw new RuntimeError("Modulo by zero", expr.line);
        return result;
      }
      case "**":
        return this.requireNumbers(left, right, "**", expr.line, (a, b) => Math.pow(a, b));

      // Comparison
      case "<":
        return this.requireNumbers(left, right, "<", expr.line, (a, b) => a < b);
      case "<=":
        return this.requireNumbers(left, right, "<=", expr.line, (a, b) => a <= b);
      case ">":
        return this.requireNumbers(left, right, ">", expr.line, (a, b) => a > b);
      case ">=":
        return this.requireNumbers(left, right, ">=", expr.line, (a, b) => a >= b);

      // Equality (works on all types)
      case "==":
        return todEquals(left, right);
      case "!=":
        return !todEquals(left, right);

      default:
        throw new RuntimeError(`Unknown operator '${expr.operator}'`, expr.line);
    }
  }

  private evalUnary(expr: Extract<Expression, { kind: "UnaryExpr" }>, env: Environment): TodValue {
    const operand = this.evalExpr(expr.operand, env);

    switch (expr.operator) {
      case "-":
        if (typeof operand !== "number") {
          throw new RuntimeError(`Cannot negate ${todTypeofShort(operand)}`, expr.line);
        }
        return -operand;
      case "!":
        return !isTruthy(operand);
      default:
        throw new RuntimeError(`Unknown unary operator '${expr.operator}'`, expr.line);
    }
  }

  private evalTernary(expr: Extract<Expression, { kind: "TernaryExpr" }>, env: Environment): TodValue {
    const condition = this.evalExpr(expr.condition, env);
    if (isTruthy(condition)) {
      return this.evalExpr(expr.consequence, env);
    } else {
      return this.evalExpr(expr.alternative, env);
    }
  }

  private evalArrayLiteral(expr: Extract<Expression, { kind: "ArrayLiteral" }>, env: Environment): TodValue {
    const elements: TodValue[] = [];
    for (const el of expr.elements) {
      if (el.kind === "SpreadExpr") {
        const spreadValue = this.evalExpr(el.operand, env);
        if (typeof spreadValue === "object" && spreadValue !== null && (spreadValue as any).type === "array") {
          elements.push(...(spreadValue as any).elements);
        } else {
          throw new RuntimeError("Can only spread arrays into arrays", el.line);
        }
      } else {
        elements.push(this.evalExpr(el, env));
      }
    }
    return { type: "array", elements };
  }

  private evalObjectLiteral(expr: Extract<Expression, { kind: "ObjectLiteral" }>, env: Environment): TodValue {
    const properties = new Map<string, TodValue>();
    for (const prop of expr.properties) {
      if (prop.value.kind === "SpreadExpr") {
        const spreadValue = this.evalExpr(prop.value.operand, env);
        if (typeof spreadValue === "object" && spreadValue !== null && (spreadValue as any).type === "object") {
          const innerProps = (spreadValue as any).properties as Map<string, TodValue>;
          for (const [k, v] of innerProps.entries()) {
            properties.set(k, v);
          }
        } else {
          throw new RuntimeError("Can only spread objects into objects", prop.value.line);
        }
      } else {
        properties.set(prop.key, this.evalExpr(prop.value, env));
      }
    }
    return { type: "object", properties };
  }

  private evalCall(expr: Extract<Expression, { kind: "CallExpr" }>, env: Environment): TodValue {
    const callee = this.evalExpr(expr.callee, env);
    const args = expr.args.map((arg) => this.evalExpr(arg, env));

    if (!isCallable(callee)) {
      throw new RuntimeError(
        `'${todStringify(callee)}' is not a function`,
        expr.line,
      );
    }

    // Built-in function
    if (callee.type === "builtin") {
      return callee.fn(...args);
    }

    // User-defined function
    if (callee.params.length !== args.length) {
      throw new RuntimeError(
        `Function '${callee.name ?? "anonymous"}' expected ${callee.params.length} argument(s) but got ${args.length}`,
        expr.line,
      );
    }

    const fnEnv = new Environment(callee.closure);
    for (let i = 0; i < callee.params.length; i++) {
      fnEnv.define(callee.params[i]!, args[i]!);
    }

    try {
      this.execBlock(callee.body, fnEnv);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        return e.value as TodValue;
      }
      throw e;
    }

    return null; // function without explicit return
  }

  private evalMember(expr: Extract<Expression, { kind: "MemberExpr" }>, env: Environment): TodValue {
    const object = this.evalExpr(expr.object, env);

    if (isTodObject(object)) {
      const value = object.properties.get(expr.property);
      if (value === undefined) {
        throw new RuntimeError(
          `Property '${expr.property}' does not exist on object`,
          expr.line,
        );
      }
      return value;
    }

    throw new RuntimeError(
      `Cannot access property '${expr.property}' on ${todTypeofShort(object)}`,
      expr.line,
    );
  }

  private evalIndex(expr: Extract<Expression, { kind: "IndexExpr" }>, env: Environment): TodValue {
    const object = this.evalExpr(expr.object, env);
    const index = this.evalExpr(expr.index, env);

    if (isTodArray(object)) {
      if (typeof index !== "number") {
        throw new RuntimeError(`Array index must be a number`, expr.line);
      }
      const i = Math.floor(index);
      if (i < 0 || i >= object.elements.length) {
        throw new RuntimeError(
          `Array index ${i} out of bounds (length ${object.elements.length})`,
          expr.line,
        );
      }
      return object.elements[i]!;
    }

    if (isTodObject(object)) {
      if (typeof index !== "string") {
        throw new RuntimeError(`Object key must be a string`, expr.line);
      }
      const value = object.properties.get(index);
      if (value === undefined) {
        throw new RuntimeError(`Property '${index}' does not exist on object`, expr.line);
      }
      return value;
    }

    throw new RuntimeError(
      `Cannot index into ${todTypeofShort(object)}`,
      expr.line,
    );
  }

  private evalFunctionExpr(expr: Extract<Expression, { kind: "FunctionExpr" }>, env: Environment): TodValue {
    const fn: TodFunction = {
      type: "function",
      name: null,
      params: expr.params,
      body: expr.body,
      closure: env,
    };
    return fn;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private requireNumbers<T>(
    left: TodValue,
    right: TodValue,
    op: string,
    line: number,
    fn: (a: number, b: number) => T,
  ): T {
    if (typeof left !== "number" || typeof right !== "number") {
      throw new RuntimeError(
        `Cannot use '${op}' on ${todTypeofShort(left)} and ${todTypeofShort(right)}`,
        line,
      );
    }
    return fn(left, right);
  }
}

// ─── Module-level Helpers ──────────────────────────────────────────────────

function todTypeofShort(value: TodValue): string {
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return value.type;
  return "unknown";
}

function todEquals(a: TodValue, b: TodValue): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  // Primitives
  if (typeof a === "number" || typeof a === "string" || typeof a === "boolean") {
    return a === b;
  }

  // Reference types — identity equality
  return a === b;
}
