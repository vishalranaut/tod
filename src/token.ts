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
  FN = "FN",
  RETURN = "RETURN",
  IF = "IF",
  ELSE = "ELSE",
  WHILE = "WHILE",

  // Operators
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  PERCENT = "PERCENT",

  ASSIGN = "ASSIGN",
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",

  LESS = "LESS",
  LESS_EQUAL = "LESS_EQUAL",
  GREATER = "GREATER",
  GREATER_EQUAL = "GREATER_EQUAL",

  BANG = "BANG",
  AND = "AND",
  OR = "OR",

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
  ["fn", TokenType.FN],
  ["return", TokenType.RETURN],
  ["if", TokenType.IF],
  ["else", TokenType.ELSE],
  ["while", TokenType.WHILE],
  ["true", TokenType.TRUE],
  ["false", TokenType.FALSE],
  ["null", TokenType.NULL],
]);
