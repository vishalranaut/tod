import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { Interpreter } from "../src/interpreter.js";

// ─── Helper ──────────────────────────────────────────────────────────────────

function runProgram(source: string): string[] {
  const tokens = new Lexer(source).tokenize();
  const program = new Parser(tokens).parse();
  const interpreter = new Interpreter();
  interpreter.interpret(program);
  return interpreter.getOutput();
}

// ─── Integration Tests ───────────────────────────────────────────────────────

describe("Integration Tests", () => {
  it("hello world", () => {
    const output = runProgram(`
      let name = "TOD";
      fn greet(user) {
        return "hello " + user;
      }
      if (name == "TOD") {
        log(greet("world"));
      }
    `);
    expect(output).toEqual(["hello world"]);
  });

  it("countdown loop", () => {
    const output = runProgram(`
      let n = 3;
      while (n > 0) {
        log("n = " + n);
        n = n - 1;
      }
    `);
    expect(output).toEqual(["n = 3", "n = 2", "n = 1"]);
  });

  it("fibonacci sequence", () => {
    const output = runProgram(`
      fn fib(n) {
        if (n <= 1) { return n; }
        return fib(n - 1) + fib(n - 2);
      }
      let i = 0;
      while (i < 8) {
        log(fib(i));
        i = i + 1;
      }
    `);
    expect(output).toEqual(["0", "1", "1", "2", "3", "5", "8", "13"]);
  });

  it("closure counter", () => {
    const output = runProgram(`
      fn makeAdder(base) {
        return fn(n) {
          return base + n;
        };
      }
      let add5 = makeAdder(5);
      let add10 = makeAdder(10);
      log(add5(3));
      log(add10(3));
    `);
    expect(output).toEqual(["8", "13"]);
  });

  it("nested if/else with boolean logic", () => {
    const output = runProgram(`
      fn classify(n) {
        if (n > 0 && n < 10) {
          return "small";
        } else if (n >= 10 && n < 100) {
          return "medium";
        } else {
          return "large";
        }
      }
      log(classify(5));
      log(classify(50));
      log(classify(500));
    `);
    expect(output).toEqual(["small", "medium", "large"]);
  });

  it("JSON round-trip", () => {
    const output = runProgram(`
      let data = json.parse("{\\"x\\": 1, \\"y\\": 2}");
      let result = json.stringify(data);
      log(result);
    `);
    expect(output).toEqual(['{"x":1,"y":2}']);
  });

  it("type checking builtins", () => {
    const output = runProgram(`
      log(type(42) == "number");
      log(type("hi") == "string");
      log(type(true) == "boolean");
      log(type(null) == "null");
    `);
    expect(output).toEqual(["true", "true", "true", "true"]);
  });

  it("string and math operations", () => {
    const output = runProgram(`
      let radius = 5;
      let area = 3.14159 * radius * radius;
      log("Area: " + floor(area));
    `);
    expect(output).toEqual(["Area: 78"]);
  });

  it("multiple functions calling each other", () => {
    const output = runProgram(`
      fn isEven(n) {
        if (n == 0) { return true; }
        return isOdd(n - 1);
      }
      fn isOdd(n) {
        if (n == 0) { return false; }
        return isEven(n - 1);
      }
      log(isEven(4));
      log(isOdd(3));
      log(isEven(7));
    `);
    expect(output).toEqual(["true", "true", "false"]);
  });

  it("variable shadowing across scopes", () => {
    const output = runProgram(`
      let x = "outer";
      {
        let x = "inner";
        log(x);
      }
      log(x);
      fn test() {
        let x = "function";
        log(x);
      }
      test();
      log(x);
    `);
    expect(output).toEqual(["inner", "outer", "function", "outer"]);
  });
});
