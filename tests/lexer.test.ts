import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer.js";
import { TokenType } from "../src/token.js";
import { LexError } from "../src/errors.js";

// ─── Helper ──────────────────────────────────────────────────────────────────

function tokenTypes(source: string): TokenType[] {
  const lexer = new Lexer(source);
  return lexer.tokenize().map((t) => t.type);
}

function tokenLexemes(source: string): string[] {
  const lexer = new Lexer(source);
  return lexer.tokenize().map((t) => t.lexeme);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Lexer", () => {
  describe("single-character tokens", () => {
    it("should tokenize delimiters", () => {
      expect(tokenTypes("( ) { } [ ] , ; .")).toEqual([
        TokenType.LPAREN, TokenType.RPAREN,
        TokenType.LBRACE, TokenType.RBRACE,
        TokenType.LBRACKET, TokenType.RBRACKET,
        TokenType.COMMA, TokenType.SEMICOLON, TokenType.DOT,
        TokenType.EOF,
      ]);
    });

    it("should tokenize arithmetic operators", () => {
      expect(tokenTypes("+ - * / %")).toEqual([
        TokenType.PLUS, TokenType.MINUS, TokenType.STAR, TokenType.SLASH, TokenType.PERCENT,
        TokenType.EOF,
      ]);
    });
  });

  describe("two-character tokens", () => {
    it("should tokenize comparison operators", () => {
      expect(tokenTypes("== != < <= > >=")).toEqual([
        TokenType.EQUAL, TokenType.NOT_EQUAL,
        TokenType.LESS, TokenType.LESS_EQUAL,
        TokenType.GREATER, TokenType.GREATER_EQUAL,
        TokenType.EOF,
      ]);
    });

    it("should tokenize compound assignment and update operators", () => {
      expect(tokenTypes("+= -= *= /= %= ++ --")).toEqual([
        TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN,
        TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN,
        TokenType.PERCENT_ASSIGN,
        TokenType.PLUS_PLUS, TokenType.MINUS_MINUS,
        TokenType.EOF,
      ]);
    });

    it("should tokenize logical operators", () => {
      expect(tokenTypes("&& || ? :")).toEqual([
        TokenType.AND, TokenType.OR,
        TokenType.QUESTION, TokenType.COLON,
        TokenType.EOF,
      ]);
    });

    it("should tokenize power and spread", () => {
      expect(tokenTypes("** ...")).toEqual([
        TokenType.POWER, TokenType.SPREAD, TokenType.EOF,
      ]);
    });

    it("should distinguish = from ==", () => {
      expect(tokenTypes("x = y == z")).toEqual([
        TokenType.IDENTIFIER, TokenType.ASSIGN,
        TokenType.IDENTIFIER, TokenType.EQUAL,
        TokenType.IDENTIFIER, TokenType.EOF,
      ]);
    });

    it("should distinguish ! from !=", () => {
      expect(tokenTypes("!x != y")).toEqual([
        TokenType.BANG, TokenType.IDENTIFIER,
        TokenType.NOT_EQUAL, TokenType.IDENTIFIER,
        TokenType.EOF,
      ]);
    });
  });

  describe("number literals", () => {
    it("should tokenize integers", () => {
      const lexer = new Lexer("42");
      const tokens = lexer.tokenize();
      expect(tokens[0]!.type).toBe(TokenType.NUMBER);
      expect(tokens[0]!.literal).toBe(42);
    });

    it("should tokenize decimals", () => {
      const lexer = new Lexer("3.14");
      const tokens = lexer.tokenize();
      expect(tokens[0]!.type).toBe(TokenType.NUMBER);
      expect(tokens[0]!.literal).toBe(3.14);
    });

    it("should tokenize zero", () => {
      const lexer = new Lexer("0");
      const tokens = lexer.tokenize();
      expect(tokens[0]!.literal).toBe(0);
    });
  });

  describe("string literals", () => {
    it("should tokenize simple strings", () => {
      const lexer = new Lexer('"hello"');
      const tokens = lexer.tokenize();
      expect(tokens[0]!.type).toBe(TokenType.STRING);
      expect(tokens[0]!.literal).toBe("hello");
    });

    it("should handle escape sequences", () => {
      const lexer = new Lexer('"line1\\nline2"');
      const tokens = lexer.tokenize();
      expect(tokens[0]!.literal).toBe("line1\nline2");
    });

    it("should handle escaped quotes", () => {
      const lexer = new Lexer('"say \\"hi\\""');
      const tokens = lexer.tokenize();
      expect(tokens[0]!.literal).toBe('say "hi"');
    });

    it("should handle escaped backslash", () => {
      const lexer = new Lexer('"path\\\\file"');
      const tokens = lexer.tokenize();
      expect(tokens[0]!.literal).toBe("path\\file");
    });

    it("should throw on unterminated string", () => {
      expect(() => new Lexer('"hello').tokenize()).toThrow(LexError);
    });

    it("should throw on invalid escape", () => {
      expect(() => new Lexer('"\\x"').tokenize()).toThrow(LexError);
    });
  });

  describe("keywords and identifiers", () => {
    it("should recognize all keywords", () => {
      expect(tokenTypes("let const fn return if else while for break continue true false null")).toEqual([
        TokenType.LET, TokenType.CONST, TokenType.FN, TokenType.RETURN,
        TokenType.IF, TokenType.ELSE, TokenType.WHILE, TokenType.FOR,
        TokenType.BREAK, TokenType.CONTINUE,
        TokenType.TRUE, TokenType.FALSE, TokenType.NULL,
        TokenType.EOF,
      ]);
    });

    it("should tokenize identifiers", () => {
      expect(tokenLexemes("foo _bar baz123")).toEqual([
        "foo", "_bar", "baz123", "",
      ]);
    });

    it("should not confuse keyword prefixes with keywords", () => {
      expect(tokenTypes("letName ifCondition")).toEqual([
        TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.EOF,
      ]);
    });

    it("should set literal for boolean keywords", () => {
      const lexer = new Lexer("true false");
      const tokens = lexer.tokenize();
      expect(tokens[0]!.literal).toBe(true);
      expect(tokens[1]!.literal).toBe(false);
    });
  });

  describe("comments", () => {
    it("should skip line comments", () => {
      expect(tokenTypes("x // comment\ny")).toEqual([
        TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.EOF,
      ]);
    });

    it("should handle comment at end of input", () => {
      expect(tokenTypes("x // last")).toEqual([
        TokenType.IDENTIFIER, TokenType.EOF,
      ]);
    });
  });

  describe("whitespace and line tracking", () => {
    it("should skip whitespace", () => {
      expect(tokenTypes("  x  \t y  ")).toEqual([
        TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.EOF,
      ]);
    });

    it("should track line numbers", () => {
      const lexer = new Lexer("x\ny\nz");
      const tokens = lexer.tokenize();
      expect(tokens[0]!.line).toBe(1);
      expect(tokens[1]!.line).toBe(2);
      expect(tokens[2]!.line).toBe(3);
    });
  });

  describe("complex expressions", () => {
    it("should tokenize a let statement", () => {
      expect(tokenTypes('let x = 42;')).toEqual([
        TokenType.LET, TokenType.IDENTIFIER, TokenType.ASSIGN,
        TokenType.NUMBER, TokenType.SEMICOLON, TokenType.EOF,
      ]);
    });

    it("should tokenize a function call", () => {
      expect(tokenTypes('log("hello");')).toEqual([
        TokenType.IDENTIFIER, TokenType.LPAREN, TokenType.STRING,
        TokenType.RPAREN, TokenType.SEMICOLON, TokenType.EOF,
      ]);
    });

    it("should tokenize a complete function", () => {
      expect(tokenTypes("fn add(a, b) { return a + b; }")).toEqual([
        TokenType.FN, TokenType.IDENTIFIER,
        TokenType.LPAREN, TokenType.IDENTIFIER, TokenType.COMMA, TokenType.IDENTIFIER, TokenType.RPAREN,
        TokenType.LBRACE, TokenType.RETURN, TokenType.IDENTIFIER, TokenType.PLUS, TokenType.IDENTIFIER, TokenType.SEMICOLON, TokenType.RBRACE,
        TokenType.EOF,
      ]);
    });
  });

  describe("error cases", () => {
    it("should throw on unexpected character", () => {
      expect(() => new Lexer("@").tokenize()).toThrow(LexError);
    });

    it("should throw on lone &", () => {
      expect(() => new Lexer("&").tokenize()).toThrow(LexError);
    });

    it("should throw on lone |", () => {
      expect(() => new Lexer("|").tokenize()).toThrow(LexError);
    });
  });
});
