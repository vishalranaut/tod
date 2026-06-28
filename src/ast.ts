// ─── AST Node Definitions ────────────────────────────────────────────────────
//
// All nodes use a discriminated union on the `kind` field.
// Every node carries a `line` number for error reporting.

// ─── Expressions ─────────────────────────────────────────────────────────────

export interface NumberLiteral {
  kind: "NumberLiteral";
  value: number;
  line: number;
}

export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
  line: number;
}

export interface BooleanLiteral {
  kind: "BooleanLiteral";
  value: boolean;
  line: number;
}

export interface NullLiteral {
  kind: "NullLiteral";
  line: number;
}

export interface Identifier {
  kind: "Identifier";
  name: string;
  line: number;
}

export interface BinaryExpr {
  kind: "BinaryExpr";
  operator: string;
  left: Expression;
  right: Expression;
  line: number;
}

export interface UnaryExpr {
  kind: "UnaryExpr";
  operator: string;
  operand: Expression;
  line: number;
}

export interface CallExpr {
  kind: "CallExpr";
  callee: Expression;
  args: Expression[];
  line: number;
}

export interface MemberExpr {
  kind: "MemberExpr";
  object: Expression;
  property: string;
  line: number;
}

export interface IndexExpr {
  kind: "IndexExpr";
  object: Expression;
  index: Expression;
  line: number;
}

export interface AssignExpr {
  kind: "AssignExpr";
  name: string;
  value: Expression;
  line: number;
}

export interface FunctionExpr {
  kind: "FunctionExpr";
  params: string[];
  body: Statement[];
  line: number;
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | IndexExpr
  | AssignExpr
  | FunctionExpr;

// ─── Statements ──────────────────────────────────────────────────────────────

export interface LetStatement {
  kind: "LetStatement";
  name: string;
  value: Expression;
  line: number;
}

export interface ReturnStatement {
  kind: "ReturnStatement";
  value: Expression | null;
  line: number;
}

export interface IfStatement {
  kind: "IfStatement";
  condition: Expression;
  consequence: Statement[];
  alternative: Statement[] | null;
  line: number;
}

export interface WhileStatement {
  kind: "WhileStatement";
  condition: Expression;
  body: Statement[];
  line: number;
}

export interface ExpressionStatement {
  kind: "ExpressionStatement";
  expression: Expression;
  line: number;
}

export interface FunctionDeclaration {
  kind: "FunctionDeclaration";
  name: string;
  params: string[];
  body: Statement[];
  line: number;
}

export interface BlockStatement {
  kind: "BlockStatement";
  statements: Statement[];
  line: number;
}

export type Statement =
  | LetStatement
  | ReturnStatement
  | IfStatement
  | WhileStatement
  | ExpressionStatement
  | FunctionDeclaration
  | BlockStatement;

// ─── Program (root node) ────────────────────────────────────────────────────

export interface Program {
  kind: "Program";
  body: Statement[];
}
