import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { ParseError } from "../src/errors.js";
import type { Program, Expression, Statement } from "../src/ast.js";

// ─── Helper ──────────────────────────────────────────────────────────────────

function parse(source: string): Program {
  const tokens = new Lexer(source).tokenize();
  return new Parser(tokens).parse();
}

function parseExpr(source: string): Expression {
  const program = parse(source + ";");
  const stmt = program.body[0]!;
  if (stmt.kind !== "ExpressionStatement") {
    throw new Error(`Expected ExpressionStatement, got ${stmt.kind}`);
  }
  return stmt.expression;
}

function firstStmt(source: string): Statement {
  return parse(source).body[0]!;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Parser", () => {
  describe("literals", () => {
    it("should parse number literals", () => {
      const expr = parseExpr("42");
      expect(expr).toMatchObject({ kind: "NumberLiteral", value: 42 });
    });

    it("should parse string literals", () => {
      const expr = parseExpr('"hello"');
      expect(expr).toMatchObject({ kind: "StringLiteral", value: "hello" });
    });

    it("should parse boolean literals", () => {
      expect(parseExpr("true")).toMatchObject({ kind: "BooleanLiteral", value: true });
      expect(parseExpr("false")).toMatchObject({ kind: "BooleanLiteral", value: false });
    });

    it("should parse null literal", () => {
      expect(parseExpr("null")).toMatchObject({ kind: "NullLiteral" });
    });
  });

  describe("binary expressions", () => {
    it("should parse addition", () => {
      const expr = parseExpr("1 + 2");
      expect(expr).toMatchObject({
        kind: "BinaryExpr",
        operator: "+",
        left: { kind: "NumberLiteral", value: 1 },
        right: { kind: "NumberLiteral", value: 2 },
      });
    });

    it("should respect precedence (* over +)", () => {
      const expr = parseExpr("1 + 2 * 3");
      expect(expr).toMatchObject({
        kind: "BinaryExpr",
        operator: "+",
        left: { kind: "NumberLiteral", value: 1 },
        right: {
          kind: "BinaryExpr",
          operator: "*",
          left: { kind: "NumberLiteral", value: 2 },
          right: { kind: "NumberLiteral", value: 3 },
        },
      });
    });

    it("should respect left-associativity", () => {
      // 1 - 2 - 3  =  (1 - 2) - 3
      const expr = parseExpr("1 - 2 - 3");
      expect(expr).toMatchObject({
        kind: "BinaryExpr",
        operator: "-",
        left: {
          kind: "BinaryExpr",
          operator: "-",
          left: { kind: "NumberLiteral", value: 1 },
          right: { kind: "NumberLiteral", value: 2 },
        },
        right: { kind: "NumberLiteral", value: 3 },
      });
    });

    it("should parse comparison operators", () => {
      expect(parseExpr("a < b")).toMatchObject({ kind: "BinaryExpr", operator: "<" });
      expect(parseExpr("a >= b")).toMatchObject({ kind: "BinaryExpr", operator: ">=" });
    });

    it("should parse equality operators", () => {
      expect(parseExpr("a == b")).toMatchObject({ kind: "BinaryExpr", operator: "==" });
      expect(parseExpr("a != b")).toMatchObject({ kind: "BinaryExpr", operator: "!=" });
    });

    it("should parse logical operators", () => {
      expect(parseExpr("a && b")).toMatchObject({ kind: "BinaryExpr", operator: "&&" });
      expect(parseExpr("a || b")).toMatchObject({ kind: "BinaryExpr", operator: "||" });
    });

    it("should handle grouped expressions", () => {
      const expr = parseExpr("(1 + 2) * 3");
      expect(expr).toMatchObject({
        kind: "BinaryExpr",
        operator: "*",
        left: {
          kind: "BinaryExpr",
          operator: "+",
        },
        right: { kind: "NumberLiteral", value: 3 },
      });
    });
  });

  describe("unary expressions", () => {
    it("should parse negation", () => {
      const expr = parseExpr("-5");
      expect(expr).toMatchObject({
        kind: "UnaryExpr",
        operator: "-",
        operand: { kind: "NumberLiteral", value: 5 },
      });
    });

    it("should parse logical not", () => {
      const expr = parseExpr("!true");
      expect(expr).toMatchObject({
        kind: "UnaryExpr",
        operator: "!",
        operand: { kind: "BooleanLiteral", value: true },
      });
    });

    it("should parse double negation", () => {
      const expr = parseExpr("--x");
      expect(expr).toMatchObject({
        kind: "UnaryExpr",
        operator: "-",
        operand: { kind: "UnaryExpr", operator: "-" },
      });
    });
  });

  describe("function calls", () => {
    it("should parse no-arg call", () => {
      const expr = parseExpr("foo()");
      expect(expr).toMatchObject({
        kind: "CallExpr",
        callee: { kind: "Identifier", name: "foo" },
        args: [],
      });
    });

    it("should parse call with arguments", () => {
      const expr = parseExpr("add(1, 2)");
      expect(expr).toMatchObject({
        kind: "CallExpr",
        callee: { kind: "Identifier", name: "add" },
        args: [
          { kind: "NumberLiteral", value: 1 },
          { kind: "NumberLiteral", value: 2 },
        ],
      });
    });

    it("should parse chained calls", () => {
      const expr = parseExpr("a()()");
      expect(expr).toMatchObject({
        kind: "CallExpr",
        callee: { kind: "CallExpr" },
      });
    });
  });

  describe("member and index access", () => {
    it("should parse dot access", () => {
      const expr = parseExpr("obj.prop");
      expect(expr).toMatchObject({
        kind: "MemberExpr",
        object: { kind: "Identifier", name: "obj" },
        property: "prop",
      });
    });

    it("should parse index access", () => {
      const expr = parseExpr("arr[0]");
      expect(expr).toMatchObject({
        kind: "IndexExpr",
        object: { kind: "Identifier", name: "arr" },
        index: { kind: "NumberLiteral", value: 0 },
      });
    });

    it("should parse chained member access", () => {
      const expr = parseExpr("a.b.c");
      expect(expr).toMatchObject({
        kind: "MemberExpr",
        object: { kind: "MemberExpr" },
        property: "c",
      });
    });

    it("should parse method call", () => {
      const expr = parseExpr("json.parse(x)");
      expect(expr).toMatchObject({
        kind: "CallExpr",
        callee: {
          kind: "MemberExpr",
          object: { kind: "Identifier", name: "json" },
          property: "parse",
        },
      });
    });
  });

  describe("assignment", () => {
    it("should parse assignment expression", () => {
      const expr = parseExpr("x = 5");
      expect(expr).toMatchObject({
        kind: "AssignExpr",
        name: "x",
        value: { kind: "NumberLiteral", value: 5 },
      });
    });
  });

  describe("let statements", () => {
    it("should parse let declaration", () => {
      const stmt = firstStmt('let x = 42;');
      expect(stmt).toMatchObject({
        kind: "LetStatement",
        name: "x",
        value: { kind: "NumberLiteral", value: 42 },
      });
    });

    it("should parse let with expression", () => {
      const stmt = firstStmt("let y = 1 + 2;");
      expect(stmt).toMatchObject({
        kind: "LetStatement",
        name: "y",
        value: { kind: "BinaryExpr", operator: "+" },
      });
    });
  });

  describe("function declarations", () => {
    it("should parse function with no params", () => {
      const stmt = firstStmt("fn greet() { return 42; }");
      expect(stmt).toMatchObject({
        kind: "FunctionDeclaration",
        name: "greet",
        params: [],
        body: [{ kind: "ReturnStatement" }],
      });
    });

    it("should parse function with params", () => {
      const stmt = firstStmt("fn add(a, b) { return a + b; }");
      expect(stmt).toMatchObject({
        kind: "FunctionDeclaration",
        name: "add",
        params: ["a", "b"],
      });
    });
  });

  describe("anonymous function expressions", () => {
    it("should parse fn expression", () => {
      const expr = parseExpr("fn(x) { return x; }");
      expect(expr).toMatchObject({
        kind: "FunctionExpr",
        params: ["x"],
      });
    });
  });

  describe("return statements", () => {
    it("should parse return with value", () => {
      const program = parse("fn f() { return 42; }");
      const fn = program.body[0]!;
      if (fn.kind !== "FunctionDeclaration") throw new Error("Expected fn");
      expect(fn.body[0]).toMatchObject({
        kind: "ReturnStatement",
        value: { kind: "NumberLiteral", value: 42 },
      });
    });

    it("should parse return without value", () => {
      const program = parse("fn f() { return; }");
      const fn = program.body[0]!;
      if (fn.kind !== "FunctionDeclaration") throw new Error("Expected fn");
      expect(fn.body[0]).toMatchObject({
        kind: "ReturnStatement",
        value: null,
      });
    });
  });

  describe("if statements", () => {
    it("should parse if without else", () => {
      const stmt = firstStmt("if (x) { y; }");
      expect(stmt).toMatchObject({
        kind: "IfStatement",
        condition: { kind: "Identifier", name: "x" },
        consequence: [{ kind: "ExpressionStatement" }],
        alternative: null,
      });
    });

    it("should parse if/else", () => {
      const stmt = firstStmt("if (x) { y; } else { z; }");
      expect(stmt).toMatchObject({
        kind: "IfStatement",
        alternative: [{ kind: "ExpressionStatement" }],
      });
    });

    it("should parse if/else if/else", () => {
      const stmt = firstStmt("if (a) { b; } else if (c) { d; } else { e; }");
      expect(stmt).toMatchObject({
        kind: "IfStatement",
        alternative: [{ kind: "IfStatement" }],
      });
    });
  });

  describe("while statements", () => {
    it("should parse while loop", () => {
      const stmt = firstStmt("while (x > 0) { x = x - 1; }");
      expect(stmt).toMatchObject({
        kind: "WhileStatement",
        condition: { kind: "BinaryExpr", operator: ">" },
        body: [{ kind: "ExpressionStatement" }],
      });
    });
  });

  describe("block statements", () => {
    it("should parse standalone block", () => {
      const stmt = firstStmt("{ let x = 1; }");
      expect(stmt).toMatchObject({
        kind: "BlockStatement",
        statements: [{ kind: "LetStatement" }],
      });
    });
  });

  describe("error handling", () => {
    it("should throw on missing semicolon", () => {
      expect(() => parse("let x = 1")).toThrow(ParseError);
    });

    it("should throw on unmatched paren", () => {
      expect(() => parse("(1 + 2;")).toThrow(ParseError);
    });

    it("should throw on unexpected token", () => {
      expect(() => parse(";")).toThrow(ParseError);
    });

    it("should throw on invalid assignment target", () => {
      expect(() => parse("1 = 2;")).toThrow(ParseError);
    });

    it("should throw on missing function name", () => {
      expect(() => parse("fn () {}")).toThrow(ParseError);
    });
  });

  describe("complex programs", () => {
    it("should parse a multi-statement program", () => {
      const program = parse(`
        let x = 10;
        fn double(n) { return n * 2; }
        if (x > 5) {
          log(double(x));
        }
      `);
      expect(program.body).toHaveLength(3);
      expect(program.body[0]!.kind).toBe("LetStatement");
      expect(program.body[1]!.kind).toBe("FunctionDeclaration");
      expect(program.body[2]!.kind).toBe("IfStatement");
    });
  });
});
