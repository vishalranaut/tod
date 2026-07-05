// ─── Token Types ─────────────────────────────────────────────────────────────

export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
  TRUE = "TRUE",
  FALSE = "FALSE",
  NULL = "NULL",

  // Identifiers & keywords
  IDENTIFIER = "IDENTIFIER",
  LET = "LET",
  CONST = "CONST",
  FN = "FN",
  RETURN = "RETURN",
  IF = "IF",
  ELSE = "ELSE",
  WHILE = "WHILE",
  FOR = "FOR",
  BREAK = "BREAK",
  CONTINUE = "CONTINUE",

  // OOP
  CLASS = "CLASS",
  THIS = "THIS",
  NEW = "NEW",
  EXTENDS = "EXTENDS",
  SUPER = "SUPER",
  INSTANCEOF = "INSTANCEOF",

  // Operators
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  PERCENT = "PERCENT",

  ASSIGN = "ASSIGN",
  PLUS_ASSIGN = "PLUS_ASSIGN",
  MINUS_ASSIGN = "MINUS_ASSIGN",
  STAR_ASSIGN = "STAR_ASSIGN",
  SLASH_ASSIGN = "SLASH_ASSIGN",
  PERCENT_ASSIGN = "PERCENT_ASSIGN",
  PLUS_PLUS = "PLUS_PLUS",
  MINUS_MINUS = "MINUS_MINUS",
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",

  LESS = "LESS",
  LESS_EQUAL = "LESS_EQUAL",
  GREATER = "GREATER",
  GREATER_EQUAL = "GREATER_EQUAL",

  AND = "AND",
  OR = "OR",
  BANG = "BANG",
  QUESTION = "QUESTION",
  COLON = "COLON",
  POWER = "POWER",
  SPREAD = "SPREAD",

  // Delimiters
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACE = "LBRACE",
  RBRACE = "RBRACE",
  LBRACKET = "LBRACKET",
  RBRACKET = "RBRACKET",
  COMMA = "COMMA",
  SEMICOLON = "SEMICOLON",
  DOT = "DOT",

  // Special
  EOF = "EOF",
}

// ─── Token ───────────────────────────────────────────────────────────────────

export interface Token {
  type: TokenType;
  lexeme: string;
  literal: string | number | boolean | null;
  line: number;
  column: number;
}

// ─── Keyword Map ─────────────────────────────────────────────────────────────

export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
  ["let", TokenType.LET],
  ["const", TokenType.CONST],
  ["fn", TokenType.FN],
  ["return", TokenType.RETURN],
  ["if", TokenType.IF],
  ["else", TokenType.ELSE],
  ["while", TokenType.WHILE],
  ["for", TokenType.FOR],
  ["break", TokenType.BREAK],
  ["continue", TokenType.CONTINUE],
  ["class", TokenType.CLASS],
  ["this", TokenType.THIS],
  ["new", TokenType.NEW],
  ["extends", TokenType.EXTENDS],
  ["super", TokenType.SUPER],
  ["instanceof", TokenType.INSTANCEOF],
  ["true", TokenType.TRUE],
  ["false", TokenType.FALSE],
  ["null", TokenType.NULL],
]);
