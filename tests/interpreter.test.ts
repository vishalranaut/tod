import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { Interpreter } from "../src/interpreter.js";
import { RuntimeError } from "../src/errors.js";
import type { TodValue } from "../src/values.js";

// ─── Helper ──────────────────────────────────────────────────────────────────

function run(source: string): { result: TodValue; output: string[] } {
  const tokens = new Lexer(source).tokenize();
  const program = new Parser(tokens).parse();
  const interpreter = new Interpreter();
  const result = interpreter.interpret(program);
  return { result, output: interpreter.getOutput() };
}

function evalExpr(source: string): TodValue {
  return run(source + ";").result;
}

function getOutput(source: string): string[] {
  return run(source).output;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Interpreter", () => {
  describe("arithmetic", () => {
    it("should evaluate addition", () => {
      expect(evalExpr("1 + 2")).toBe(3);
    });

    it("should evaluate subtraction", () => {
      expect(evalExpr("10 - 3")).toBe(7);
    });

    it("should evaluate multiplication", () => {
      expect(evalExpr("4 * 5")).toBe(20);
    });

    it("should evaluate division", () => {
      expect(evalExpr("10 / 4")).toBe(2.5);
    });

    it("should evaluate modulo", () => {
      expect(evalExpr("10 % 3")).toBe(1);
    });

    it("should evaluate power", () => {
      expect(evalExpr("2 ** 3")).toBe(8);
      expect(evalExpr("2 ** 3 ** 2")).toBe(512); // right-associative
    });

    it("should respect operator precedence", () => {
      expect(evalExpr("2 + 3 * 4")).toBe(14);
    });

    it("should respect parentheses", () => {
      expect(evalExpr("(2 + 3) * 4")).toBe(20);
    });

    it("should handle negation", () => {
      expect(evalExpr("-5")).toBe(-5);
    });

    it("should handle double negation", () => {
      expect(evalExpr("- -5")).toBe(5);
    });

    it("should throw on division by zero", () => {
      expect(() => evalExpr("1 / 0")).toThrow(RuntimeError);
    });

    it("should throw on modulo by zero", () => {
      expect(() => evalExpr("1 % 0")).toThrow(RuntimeError);
    });
  });

  describe("string operations", () => {
    it("should concatenate strings", () => {
      expect(evalExpr('"hello" + " " + "world"')).toBe("hello world");
    });

    it("should concatenate string and number", () => {
      expect(evalExpr('"age: " + 25')).toBe("age: 25");
    });

    it("should concatenate number and string", () => {
      expect(evalExpr('42 + " is the answer"')).toBe("42 is the answer");
    });

    it("should throw on non-numeric subtraction with strings", () => {
      expect(() => evalExpr('"a" - "b"')).toThrow(RuntimeError);
    });
  });

  describe("comparisons", () => {
    it("should compare numbers", () => {
      expect(evalExpr("1 < 2")).toBe(true);
      expect(evalExpr("2 > 1")).toBe(true);
      expect(evalExpr("1 <= 1")).toBe(true);
      expect(evalExpr("2 >= 3")).toBe(false);
    });

    it("should compare equality", () => {
      expect(evalExpr("1 == 1")).toBe(true);
      expect(evalExpr("1 == 2")).toBe(false);
      expect(evalExpr('"a" == "a"')).toBe(true);
      expect(evalExpr("true == true")).toBe(true);
      expect(evalExpr("null == null")).toBe(true);
    });

    it("should compare inequality", () => {
      expect(evalExpr("1 != 2")).toBe(true);
      expect(evalExpr("1 != 1")).toBe(false);
    });

    it("should not coerce types in equality", () => {
      expect(evalExpr('1 == "1"')).toBe(false);
      expect(evalExpr("0 == false")).toBe(false);
      expect(evalExpr("null == false")).toBe(false);
    });
  });

  describe("boolean logic", () => {
    it("should evaluate logical not", () => {
      expect(evalExpr("!true")).toBe(false);
      expect(evalExpr("!false")).toBe(true);
      expect(evalExpr("!null")).toBe(true);
      expect(evalExpr("!0")).toBe(false); // 0 is truthy in TOD (only null and false are falsy)
    });

    it("should short-circuit &&", () => {
      expect(evalExpr("true && 42")).toBe(42);
      expect(evalExpr("false && 42")).toBe(false);
      expect(evalExpr("null && 42")).toBe(null);
    });

    it("should short-circuit ||", () => {
      expect(evalExpr("false || 42")).toBe(42);
      expect(evalExpr("null || 42")).toBe(42);
      expect(evalExpr("true || 42")).toBe(true);
    });
  });

  describe("ternary operators", () => {
    it("should evaluate consequence when condition is true", () => {
      expect(evalExpr('true ? 1 : 2')).toBe(1);
      expect(evalExpr('1 > 0 ? "yes" : "no"')).toBe("yes");
    });

    it("should evaluate alternative when condition is false", () => {
      expect(evalExpr('false ? 1 : 2')).toBe(2);
      expect(evalExpr('1 < 0 ? "yes" : "no"')).toBe("no");
    });

    it("should short-circuit ternary", () => {
      const { result } = run(`
        let x = 0;
        let y = 0;
        true ? (x++) : (y++);
        y;
      `);
      expect(result).toBe(0);
    });
  });

  describe("arrays and objects", () => {
    it("should create arrays and objects", () => {
      const arr = evalExpr("[1, 2, 3]") as any;
      expect(arr.type).toBe("array");
      expect(arr.elements).toEqual([1, 2, 3]);

      const obj = evalExpr("({ a: 1, b: 2 })") as any;
      expect(obj.type).toBe("object");
      expect(obj.properties.get("a")).toBe(1);
      expect(obj.properties.get("b")).toBe(2);
    });

    it("should support spread in arrays", () => {
      const { result } = run(`
        let a = [1, 2];
        [0, ...a, 3];
      `);
      const arr = result as any;
      expect(arr.elements).toEqual([0, 1, 2, 3]);
    });

    it("should support spread in objects", () => {
      const { result } = run(`
        let base = { a: 1, b: 2 };
        ({ ...base, c: 3, a: 10 });
      `);
      const obj = result as any;
      expect(obj.properties.get("a")).toBe(10);
      expect(obj.properties.get("b")).toBe(2);
      expect(obj.properties.get("c")).toBe(3);
    });
  });

  describe("variables", () => {
    it("should declare and read variables", () => {
      const { result } = run("let x = 42; x;");
      expect(result).toBe(42);
    });

    it("should assign to existing variables", () => {
      const { result } = run("let x = 1; x = 2; x;");
      expect(result).toBe(2);
    });

    it("should support compound assignment (+=, -=, *=, /=, %=)", () => {
      const { result } = run(`
        let a = 10;
        a += 5;
        let b = 10;
        b -= 3;
        let c = 10;
        c *= 2;
        let d = 10;
        d /= 2;
        let e = 10;
        e %= 3;
        a + b + c + d + e;
      `);
      expect(result).toBe(15 + 7 + 20 + 5 + 1);
    });

    it("should support update expressions (++, --)", () => {
      const { result } = run(`
        let i = 0;
        i++;
        let j = 5;
        j--;
        i + j;
      `);
      expect(result).toBe(1 + 4);
    });

    it("should throw on undefined variable", () => {
      expect(() => evalExpr("undeclared")).toThrow(RuntimeError);
    });

    it("should throw on assigning to undefined variable", () => {
      expect(() => run("x = 5;")).toThrow(RuntimeError);
    });
  });

  describe("const statements", () => {
    it("should declare and read const variables", () => {
      const { result } = run("const PI = 3.14; PI;");
      expect(result).toBe(3.14);
    });

    it("should throw on reassignment of const variable", () => {
      expect(() => run("const MAX = 100; MAX = 200;")).toThrow(RuntimeError);
    });

    it("should throw on compound assignment of const variable", () => {
      expect(() => run("const MAX = 100; MAX += 10;")).toThrow(RuntimeError);
    });

    it("should throw on update of const variable", () => {
      expect(() => run("const MAX = 100; MAX++;")).toThrow(RuntimeError);
    });
  });

  describe("scoping", () => {
    it("should create block scope", () => {
      const { result } = run(`
        let x = 1;
        { let x = 2; }
        x;
      `);
      expect(result).toBe(1);
    });

    it("should access outer scope", () => {
      const { result } = run(`
        let x = 10;
        { let y = x + 5; y; }
      `);
      expect(result).toBe(15);
    });

    it("should modify outer scope variable", () => {
      const { result } = run(`
        let x = 1;
        { x = 2; }
        x;
      `);
      expect(result).toBe(2);
    });
  });

  describe("if/else", () => {
    it("should execute consequence when true", () => {
      const output = getOutput('if (true) { log("yes"); }');
      expect(output).toEqual(["yes"]);
    });

    it("should skip consequence when false", () => {
      const output = getOutput('if (false) { log("yes"); }');
      expect(output).toEqual([]);
    });

    it("should execute alternative when false", () => {
      const output = getOutput('if (false) { log("yes"); } else { log("no"); }');
      expect(output).toEqual(["no"]);
    });

    it("should handle else if chains", () => {
      const output = getOutput(`
        let x = 2;
        if (x == 1) { log("one"); }
        else if (x == 2) { log("two"); }
        else { log("other"); }
      `);
      expect(output).toEqual(["two"]);
    });
  });

  describe("while loops", () => {
    it("should execute loop body", () => {
      const output = getOutput(`
        let i = 0;
        while (i < 3) {
          log(i);
          i = i + 1;
        }
      `);
      expect(output).toEqual(["0", "1", "2"]);
    });

    it("should not execute if condition is initially false", () => {
      const output = getOutput('while (false) { log("nope"); }');
      expect(output).toEqual([]);
    });

    it("should support break", () => {
      const output = getOutput(`
        let i = 0;
        while (true) {
          if (i == 3) { break; }
          log(i);
          i++;
        }
      `);
      expect(output).toEqual(["0", "1", "2"]);
    });

    it("should support continue", () => {
      const output = getOutput(`
        let i = 0;
        while (i < 5) {
          i++;
          if (i % 2 == 0) { continue; }
          log(i);
        }
      `);
      expect(output).toEqual(["1", "3", "5"]);
    });
  });

  describe("for loops", () => {
    it("should execute standard for loop", () => {
      const output = getOutput(`
        for (let i = 0; i < 3; i++) {
          log(i);
        }
      `);
      expect(output).toEqual(["0", "1", "2"]);
    });

    it("should support break and continue in for loop", () => {
      const output = getOutput(`
        for (let i = 0; i < 10; i++) {
          if (i == 2) { continue; }
          if (i == 5) { break; }
          log(i);
        }
      `);
      expect(output).toEqual(["0", "1", "3", "4"]);
    });
  });

  describe("functions", () => {
    it("should declare and call functions", () => {
      const output = getOutput(`
        fn greet(name) {
          return "hello " + name;
        }
        log(greet("TOD"));
      `);
      expect(output).toEqual(["hello TOD"]);
    });

    it("should handle functions with no return", () => {
      const { result } = run(`
        fn noop() { let x = 1; }
        noop();
      `);
      expect(result).toBe(null);
    });

    it("should handle recursive functions", () => {
      const output = getOutput(`
        fn fib(n) {
          if (n <= 1) { return n; }
          return fib(n - 1) + fib(n - 2);
        }
        log(fib(10));
      `);
      expect(output).toEqual(["55"]);
    });

    it("should handle closures", () => {
      const output = getOutput(`
        fn makeCounter() {
          let count = 0;
          return fn() {
            count = count + 1;
            return count;
          };
        }
        let counter = makeCounter();
        log(counter());
        log(counter());
        log(counter());
      `);
      expect(output).toEqual(["1", "2", "3"]);
    });

    it("should throw on wrong argument count", () => {
      expect(() =>
        run(`
        fn add(a, b) { return a + b; }
        add(1);
      `),
      ).toThrow(RuntimeError);
    });

    it("should throw when calling non-function", () => {
      expect(() => run('let x = 5; x();')).toThrow(RuntimeError);
    });
  });

  describe("builtins", () => {
    it("log should print values", () => {
      const output = getOutput('log("hello"); log(42); log(true); log(null);');
      expect(output).toEqual(["hello", "42", "true", "null"]);
    });

    it("log should handle multiple arguments", () => {
      const output = getOutput('log("x =", 42);');
      expect(output).toEqual(["x = 42"]);
    });

    it("type should return type names", () => {
      const output = getOutput(`
        log(type(42));
        log(type("hello"));
        log(type(true));
        log(type(null));
        log(type(log));
      `);
      expect(output).toEqual(["number", "string", "boolean", "null", "function"]);
    });

    it("len should return string length", () => {
      expect(evalExpr('len("hello")')).toBe(5);
    });

    it("len should throw on non-string/array", () => {
      expect(() => evalExpr("len(42)")).toThrow(RuntimeError);
    });

    it("toNumber should convert strings", () => {
      expect(evalExpr('toNumber("42")')).toBe(42);
    });

    it("toNumber should throw on invalid string", () => {
      expect(() => evalExpr('toNumber("abc")')).toThrow(RuntimeError);
    });

    it("toString should convert values", () => {
      expect(evalExpr("toString(42)")).toBe("42");
      expect(evalExpr("toString(true)")).toBe("true");
    });

    it("time should return a number", () => {
      const result = evalExpr("time()");
      expect(typeof result).toBe("number");
    });

    it("floor/ceil/abs should work on numbers", () => {
      expect(evalExpr("floor(3.7)")).toBe(3);
      expect(evalExpr("ceil(3.2)")).toBe(4);
      expect(evalExpr("abs(-5)")).toBe(5);
    });

    it("random should return a number between 0 and 1", () => {
      const result = evalExpr("random()");
      expect(typeof result).toBe("number");
      expect(result as number).toBeGreaterThanOrEqual(0);
      expect(result as number).toBeLessThan(1);
    });
  });

  describe("JSON builtins", () => {
    it("json.parse should parse JSON strings", () => {
      const output = getOutput(`
        let data = json.parse("{\\"name\\": \\"tod\\", \\"version\\": 1}");
        log(data.name);
        log(data.version);
      `);
      expect(output).toEqual(["tod", "1"]);
    });

    it("json.stringify should serialize values", () => {
      const { result } = run('json.stringify(42);');
      expect(result).toBe("42");
    });

    it("json.parse should handle arrays", () => {
      const output = getOutput(`
        let arr = json.parse("[1, 2, 3]");
        log(len(arr));
        log(arr[0]);
        log(arr[2]);
      `);
      expect(output).toEqual(["3", "1", "3"]);
    });

    it("json.parse should throw on invalid JSON", () => {
      expect(() => evalExpr('json.parse("not json")')).toThrow(RuntimeError);
    });
  });

  describe("member and index access", () => {
    it("should access object properties", () => {
      const output = getOutput(`
        let obj = json.parse("{\\"a\\": 1, \\"b\\": 2}");
        log(obj.a);
        log(obj.b);
      `);
      expect(output).toEqual(["1", "2"]);
    });

    it("should access array elements", () => {
      const output = getOutput(`
        let arr = json.parse("[10, 20, 30]");
        log(arr[1]);
      `);
      expect(output).toEqual(["20"]);
    });

    it("should throw on out-of-bounds index", () => {
      expect(() => run('let arr = json.parse("[1]"); arr[5];')).toThrow(RuntimeError);
    });

    it("should throw on property access on non-object", () => {
      expect(() => run("let x = 5; x.prop;")).toThrow(RuntimeError);
    });
  });

  describe("complex programs", () => {
    it("should run FizzBuzz", () => {
      const output = getOutput(`
        let i = 1;
        while (i <= 15) {
          if (i % 15 == 0) {
            log("FizzBuzz");
          } else if (i % 3 == 0) {
            log("Fizz");
          } else if (i % 5 == 0) {
            log("Buzz");
          } else {
            log(i);
          }
          i = i + 1;
        }
      `);
      expect(output).toEqual([
        "1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz",
        "11", "Fizz", "13", "14", "FizzBuzz",
      ]);
    });

    it("should handle higher-order functions", () => {
      const output = getOutput(`
        fn apply(f, x) {
          return f(x);
        }
        fn double(n) {
          return n * 2;
        }
        log(apply(double, 21));
      `);
      expect(output).toEqual(["42"]);
    });

    it("should handle nested scopes correctly", () => {
      const output = getOutput(`
        let x = "global";
        fn outer() {
          let x = "outer";
          fn inner() {
            return x;
          }
          return inner();
        }
        log(outer());
        log(x);
      `);
      expect(output).toEqual(["outer", "global"]);
    });

    it("should handle factorial", () => {
      const output = getOutput(`
        fn factorial(n) {
          if (n <= 1) { return 1; }
          return n * factorial(n - 1);
        }
        log(factorial(10));
      `);
      expect(output).toEqual(["3628800"]);
    });
  });
});
