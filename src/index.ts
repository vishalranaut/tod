// ─── Public API ──────────────────────────────────────────────────────────────
//
// This module exports the core TOD components so the package can also be
// used as a library (not just a CLI).
//
//   import { Lexer, Parser, Interpreter } from "todlang";
//

export { Lexer } from "./lexer.js";
export { Parser } from "./parser.js";
export { Interpreter } from "./interpreter.js";
export { Environment } from "./environment.js";

export type {
  Program,
  Statement,
  Expression,
  LetStatement,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ExpressionStatement,
  FunctionDeclaration,
  BlockStatement,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
  Identifier,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  AssignExpr,
  FunctionExpr,
} from "./ast.js";

export { TokenType, KEYWORDS } from "./token.js";
export type { Token } from "./token.js";

export {
  type TodValue,
  type TodFunction,
  type TodBuiltin,
  type TodObject,
  type TodArray,
  isTruthy,
  isCallable,
  isTodObject,
  isTodArray,
  todTypeof,
  todStringify,
  jsToTod,
  todToJs,
} from "./values.js";

export {
  LexError,
  ParseError,
  RuntimeError,
  ReturnSignal,
  formatError,
} from "./errors.js";
