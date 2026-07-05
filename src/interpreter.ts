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
  type TodClass,
  type TodInstance,
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
      case "ClassDeclaration":
        return this.execClassDeclaration(stmt, env);
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
    if (stmt.name) {
      env.define(stmt.name, fn);
    }
    return null;
  }

  private execClassDeclaration(stmt: Extract<Statement, { kind: "ClassDeclaration" }>, env: Environment): TodValue {
    let parentClass: TodClass | undefined;
    if (stmt.superClass) {
      const superClassVal = this.evalExpr(stmt.superClass, env);
      if (typeof superClassVal !== "object" || superClassVal === null || superClassVal.type !== "class") {
        throw new RuntimeError("Superclass must be a class", stmt.superClass.line);
      }
      parentClass = superClassVal as TodClass;
    }

    const methodsEnv = new Environment(env);
    
    const methods = new Map<string, TodFunction>();
    const staticMethods = new Map<string, TodFunction>();
    const getters = new Map<string, TodFunction>();
    const setters = new Map<string, TodFunction>();

    for (const method of stmt.methods) {
      const fn: TodFunction = {
        type: "function",
        name: method.name!,
        params: method.params,
        body: method.body,
        closure: methodsEnv, // Bind to the methods environment
      };

      if (method.isStatic) {
        staticMethods.set(method.name!, fn);
      } else if (method.accessorType === "get") {
        getters.set(method.name!, fn);
      } else if (method.accessorType === "set") {
        setters.set(method.name!, fn);
      } else {
        methods.set(method.name!, fn);
      }
    }

    const todClass: TodClass = {
      type: "class",
      name: stmt.name,
      parent: parentClass,
      methods,
      staticMethods,
      getters,
      setters,
    };

    if (parentClass) {
      methodsEnv.define("super", parentClass);
    }

    env.define(stmt.name, todClass);
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

  private evalSuperExpr(expr: Extract<Expression, { kind: "SuperExpr" }>, env: Environment): TodValue {
    let parentClass: TodClass;
    try {
      parentClass = env.get("super", expr.line) as TodClass;
    } catch {
      throw new RuntimeError("Cannot use 'super' outside of a subclass method", expr.line);
    }

    let instance: TodInstance;
    try {
      instance = env.get("this", expr.line) as TodInstance;
    } catch {
      throw new RuntimeError("Cannot use 'super' outside of a method", expr.line);
    }

    const methodName = expr.method ?? "constructor";
    let currentClass: TodClass | undefined = parentClass;
    let method: TodFunction | undefined;

    while (currentClass) {
      if (currentClass.methods.has(methodName)) {
        method = currentClass.methods.get(methodName);
        break;
      }
      currentClass = currentClass.parent;
    }

    if (!method) {
      throw new RuntimeError(`Method '${methodName}' not found in superclass`, expr.line);
    }

    const boundEnv = new Environment(method.closure);
    boundEnv.define("this", instance);
    return {
      type: "function",
      name: method.name,
      params: method.params,
      body: method.body,
      closure: boundEnv,
    };
  }

  // ─── Evaluation Utilities ────────────────────────────────────────────

  private evalNewExpr(expr: Extract<Expression, { kind: "NewExpr" }>, env: Environment): TodValue {
    const callee = this.evalExpr(expr.callee, env);
    if (typeof callee !== "object" || callee === null || callee.type !== "class") {
      throw new RuntimeError(`${todStringify(callee)} is not a class`, expr.line);
    }

    const instance: TodInstance = {
      type: "instance",
      todClass: callee,
      fields: new Map(),
    };

    // Find constructor in class hierarchy
    let currentClass: TodClass | undefined = callee;
    let constructorMethod: TodFunction | undefined;
    while (currentClass) {
      if (currentClass.methods.has("constructor")) {
        constructorMethod = currentClass.methods.get("constructor");
        break;
      }
      currentClass = currentClass.parent;
    }

    if (constructorMethod) {
      const boundEnv = new Environment(constructorMethod.closure);
      boundEnv.define("this", instance);
      const boundConstructor: TodFunction = {
        type: "function",
        name: "constructor",
        params: constructorMethod.params,
        body: constructorMethod.body,
        closure: boundEnv,
      };

      const args = expr.args.map((arg) => this.evalExpr(arg, env));
      if (args.length !== boundConstructor.params.length) {
        throw new RuntimeError(`Expected ${boundConstructor.params.length} arguments but got ${args.length}`, expr.line);
      }

      const execEnv = new Environment(boundConstructor.closure);
      for (let i = 0; i < boundConstructor.params.length; i++) {
        execEnv.define(boundConstructor.params[i], args[i]);
      }

      try {
        this.execBlock(boundConstructor.body, execEnv);
      } catch (e) {
        if (e instanceof ReturnSignal) {
          // Constructors implicitly return `this` unless they explicitly return an object (but in TOD we just always return instance for simplicity).
          // If they returned a value, we just ignore it and return the instance anyway, or return it if it's an object. 
          // Let's just always return the instance for simplicity, matching basic JS behavior when returning primitives.
        } else {
          throw e;
        }
      }
    } else if (expr.args.length > 0) {
      throw new RuntimeError(`Expected 0 arguments but got ${expr.args.length}`, expr.line);
    }

    return instance;
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
      case "NewExpr":
        return this.evalNewExpr(expr, env);
      case "ThisExpr":
        return env.get("this", expr.line);
      case "SuperExpr":
        return this.evalSuperExpr(expr, env);
    }
  }

  private getTargetValue(target: Expression, env: Environment): TodValue {
    if (target.kind === "Identifier") {
      return env.get(target.name, target.line);
    } else if (target.kind === "MemberExpr") {
      const obj = this.evalExpr(target.object, env);
      if (typeof obj !== "object" || obj === null) throw new RuntimeError(`Cannot read property '${target.property}' on ${todTypeofShort(obj)}`, target.line);
      
      if (obj.type === "class") {
        return obj.staticMethods.has(target.property) ? obj.staticMethods.get(target.property)! : null;
      }

      if (obj.type === "instance") {
        // Look up getters first
        let currentClass: TodClass | undefined = obj.todClass;
        while (currentClass) {
          if (currentClass.getters.has(target.property)) {
            const getter = currentClass.getters.get(target.property)!;
            const boundEnv = new Environment(getter.closure);
            boundEnv.define("this", obj);
            try {
              this.execBlock(getter.body, boundEnv);
              return null; // Implicit return
            } catch (e) {
              if (e instanceof ReturnSignal) return e.value as TodValue;
              throw e;
            }
          }
          currentClass = currentClass.parent;
        }

        return obj.fields.has(target.property) ? obj.fields.get(target.property)! : null;
      }
      const props = (obj as any).properties as Map<string, TodValue>;
      return props.has(target.property) ? props.get(target.property)! : null;
    } else if (target.kind === "IndexExpr") {
      const obj = this.evalExpr(target.object, env);
      const index = this.evalExpr(target.index, env);
      if (typeof obj === "object" && obj !== null && (obj as any).type === "array") {
        if (typeof index !== "number") throw new RuntimeError("Array index must be a number", target.line);
        const elements = (obj as any).elements as TodValue[];
        if (index < 0 || index >= elements.length) throw new RuntimeError("Index out of bounds", target.line);
        return elements[index];
      }
      throw new RuntimeError(`Cannot index into ${todTypeofShort(obj)}`, target.line);
    }
    throw new RuntimeError("Invalid assignment target", target.line);
  }

  private setTargetValue(target: Expression, value: TodValue, env: Environment): void {
    if (target.kind === "Identifier") {
      env.set(target.name, value, target.line);
    } else if (target.kind === "MemberExpr") {
      const obj = this.evalExpr(target.object, env);
      if (typeof obj !== "object" || obj === null) throw new RuntimeError(`Cannot set property '${target.property}' on ${todTypeofShort(obj)}`, target.line);
      if (obj.type === "instance") {
        // Look up setters first
        let currentClass: TodClass | undefined = obj.todClass;
        while (currentClass) {
          if (currentClass.setters.has(target.property)) {
            const setter = currentClass.setters.get(target.property)!;
            const boundEnv = new Environment(setter.closure);
            boundEnv.define("this", obj);
            boundEnv.define(setter.params[0]!, value);
            try {
              this.execBlock(setter.body, boundEnv);
            } catch (e) {
              if (e instanceof ReturnSignal) { /* ignore return value of setters */ }
              else throw e;
            }
            return;
          }
          currentClass = currentClass.parent;
        }

        obj.fields.set(target.property, value);
        return;
      }
      const props = (obj as any).properties as Map<string, TodValue>;
      props.set(target.property, value);
    } else if (target.kind === "IndexExpr") {
      const obj = this.evalExpr(target.object, env);
      const index = this.evalExpr(target.index, env);
      if (typeof obj === "object" && obj !== null && (obj as any).type === "array") {
        if (typeof index !== "number") throw new RuntimeError("Array index must be a number", target.line);
        const elements = (obj as any).elements as TodValue[];
        if (index < 0 || index >= elements.length) throw new RuntimeError("Index out of bounds", target.line);
        elements[index] = value;
        return;
      }
      throw new RuntimeError(`Cannot set index on ${todTypeofShort(obj)}`, target.line);
    } else {
      throw new RuntimeError("Invalid assignment target", target.line);
    }
  }

  private evalAssign(expr: Extract<Expression, { kind: "AssignExpr" }>, env: Environment): TodValue {
    const value = this.evalExpr(expr.value, env);
    this.setTargetValue(expr.target, value, env);
    return value;
  }

  private evalCompoundAssign(expr: Extract<Expression, { kind: "CompoundAssignExpr" }>, env: Environment): TodValue {
    const current = this.getTargetValue(expr.target, env);
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

    this.setTargetValue(expr.target, newValue, env);
    return newValue;
  }

  private evalUpdate(expr: Extract<Expression, { kind: "UpdateExpr" }>, env: Environment): TodValue {
    const current = this.getTargetValue(expr.target, env);
    if (typeof current !== "number") {
      throw new RuntimeError(`Cannot use '${expr.operator}' on non-number`, expr.line);
    }
    
    // Postfix update returns the original value, then updates
    const newValue = expr.operator === "++" ? current + 1 : current - 1;
    this.setTargetValue(expr.target, newValue, env);
    
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

      case "instanceof":
        if (typeof right !== "object" || right === null || right.type !== "class") {
          throw new RuntimeError("Right side of 'instanceof' must be a class", expr.line);
        }
        if (typeof left !== "object" || left === null || left.type !== "instance") {
          return false;
        }
        let currentClass: TodClass | undefined = left.todClass;
        while (currentClass) {
          if (currentClass === right) return true;
          currentClass = currentClass.parent;
        }
        return false;

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
    const obj = this.evalExpr(expr.object, env);
    if (obj !== null && typeof obj === "object") {
      if (obj.type === "object") {
        const props = obj.properties;
        return props.has(expr.property) ? props.get(expr.property)! : null;
      } else if (obj.type === "class") {
        return obj.staticMethods.has(expr.property) ? obj.staticMethods.get(expr.property)! : null;
      } else if (obj.type === "instance") {
        // Look up getters first
        let currentClass: TodClass | undefined = obj.todClass;
        while (currentClass) {
          if (currentClass.getters.has(expr.property)) {
            const getter = currentClass.getters.get(expr.property)!;
            const boundEnv = new Environment(getter.closure);
            boundEnv.define("this", obj);
            try {
              this.execBlock(getter.body, boundEnv);
              return null; // Implicit return
            } catch (e) {
              if (e instanceof ReturnSignal) return e.value as TodValue;
              throw e;
            }
          }
          currentClass = currentClass.parent;
        }

        // Look up fields on the instance
        if (obj.fields.has(expr.property)) {
          return obj.fields.get(expr.property)!;
        }
        // Look up methods on the class and its parents
        currentClass = obj.todClass;
        while (currentClass) {
          if (currentClass.methods.has(expr.property)) {
            const method = currentClass.methods.get(expr.property)!;
            // Return a bound method
            const boundEnv = new Environment(method.closure);
            boundEnv.define("this", obj);
            return {
              type: "function",
              name: method.name,
              params: method.params,
              body: method.body,
              closure: boundEnv,
            };
          }
          currentClass = currentClass.parent;
        }
        return null; // Property not found
      }
    }
    throw new RuntimeError(`Cannot access property '${expr.property}' on ${todTypeofShort(obj)}`, expr.line);
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
