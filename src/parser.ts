import { Token, TokenType } from "./token.js";
import { ParseError } from "./errors.js";
import type {
  Program,
  Statement,
  Expression,
  LetStatement,
  ConstStatement,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  BreakStatement,
  ContinueStatement,
  FunctionDeclaration,
  ExpressionStatement,
  BlockStatement,
} from "./ast.js";

// ─── Parser ──────────────────────────────────────────────────────────────────
//
// Recursive-descent parser consuming a token stream and producing an AST.
//
// Precedence (lowest → highest):
//   assignment  →  or  →  and  →  equality  →  comparison
//   →  term  →  factor  →  unary  →  call/member  →  primary

export class Parser {
  private readonly tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse the token stream into a Program AST.
   */
  parse(): Program {
    const body: Statement[] = [];

    while (!this.isAtEnd()) {
      body.push(this.parseStatement());
    }

    return { kind: "Program", body };
  }

  // ─── Statement Parsing ───────────────────────────────────────────────

  private parseStatement(): Statement {
    if (this.check(TokenType.LET)) return this.parseLetStatement();
    if (this.check(TokenType.CONST)) return this.parseConstStatement();
    if (this.check(TokenType.FN) && this.peekNext().type === TokenType.IDENTIFIER) return this.parseFunctionDeclaration();
    if (this.check(TokenType.RETURN)) return this.parseReturnStatement();
    if (this.check(TokenType.IF)) return this.parseIfStatement();
    if (this.check(TokenType.WHILE)) return this.parseWhileStatement();
    if (this.check(TokenType.FOR)) return this.parseForStatement();
    if (this.check(TokenType.BREAK)) return this.parseBreakStatement();
    if (this.check(TokenType.CONTINUE)) return this.parseContinueStatement();
    if (this.check(TokenType.LBRACE)) return this.parseBlockStatement();

    return this.parseExpressionStatement();
  }

  private parseLetStatement(): LetStatement {
    const letToken = this.expect(TokenType.LET, "Expected 'let'");
    const nameToken = this.expect(TokenType.IDENTIFIER, "Expected variable name after 'let'");
    this.expect(TokenType.ASSIGN, "Expected '=' after variable name");
    const value = this.parseExpression();
    this.expect(TokenType.SEMICOLON, "Expected ';' after variable declaration");

    return {
      kind: "LetStatement",
      name: nameToken.lexeme,
      value,
      line: letToken.line,
    };
  }

  private parseConstStatement(): ConstStatement {
    const constToken = this.expect(TokenType.CONST, "Expected 'const'");
    const nameToken = this.expect(TokenType.IDENTIFIER, "Expected variable name after 'const'");
    this.expect(TokenType.ASSIGN, "Expected '=' after variable name");
    const value = this.parseExpression();
    this.expect(TokenType.SEMICOLON, "Expected ';' after variable declaration");

    return {
      kind: "ConstStatement",
      name: nameToken.lexeme,
      value,
      line: constToken.line,
    };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const fnToken = this.expect(TokenType.FN, "Expected 'fn'");
    const nameToken = this.expect(TokenType.IDENTIFIER, "Expected function name after 'fn'");
    const params = this.parseParams();
    const body = this.parseBlock();

    return {
      kind: "FunctionDeclaration",
      name: nameToken.lexeme,
      params,
      body,
      line: fnToken.line,
    };
  }

  private parseReturnStatement(): ReturnStatement {
    const returnToken = this.expect(TokenType.RETURN, "Expected 'return'");

    let value: Expression | null = null;
    if (!this.check(TokenType.SEMICOLON)) {
      value = this.parseExpression();
    }

    this.expect(TokenType.SEMICOLON, "Expected ';' after return statement");

    return {
      kind: "ReturnStatement",
      value,
      line: returnToken.line,
    };
  }

  private parseIfStatement(): IfStatement {
    const ifToken = this.expect(TokenType.IF, "Expected 'if'");
    this.expect(TokenType.LPAREN, "Expected '(' after 'if'");
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN, "Expected ')' after if condition");

    const consequence = this.parseBlock();

    let alternative: Statement[] | null = null;
    if (this.match(TokenType.ELSE)) {
      if (this.check(TokenType.IF)) {
        // else if — wrap in a single-element block
        alternative = [this.parseIfStatement()];
      } else {
        alternative = this.parseBlock();
      }
    }

    return {
      kind: "IfStatement",
      condition,
      consequence,
      alternative,
      line: ifToken.line,
    };
  }

  private parseWhileStatement(): WhileStatement {
    const whileToken = this.expect(TokenType.WHILE, "Expected 'while'");
    this.expect(TokenType.LPAREN, "Expected '(' after 'while'");
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN, "Expected ')' after while condition");
    const body = this.parseBlock();

    return {
      kind: "WhileStatement",
      condition,
      body,
      line: whileToken.line,
    };
  }

  private parseForStatement(): ForStatement {
    const forToken = this.expect(TokenType.FOR, "Expected 'for'");
    this.expect(TokenType.LPAREN, "Expected '(' after 'for'");
    
    let init: Statement | null = null;
    if (this.check(TokenType.SEMICOLON)) {
      this.advance();
    } else if (this.check(TokenType.LET)) {
      init = this.parseLetStatement();
    } else if (this.check(TokenType.CONST)) {
      init = this.parseConstStatement();
    } else {
      init = this.parseExpressionStatement();
    }

    let condition: Expression | null = null;
    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON, "Expected ';' after loop condition");

    let update: Expression | null = null;
    if (!this.check(TokenType.RPAREN)) {
      update = this.parseExpression();
    }
    this.expect(TokenType.RPAREN, "Expected ')' after for clauses");

    const body = this.parseBlock();

    return {
      kind: "ForStatement",
      init,
      condition,
      update,
      body,
      line: forToken.line,
    };
  }

  private parseBreakStatement(): BreakStatement {
    const token = this.expect(TokenType.BREAK, "Expected 'break'");
    this.expect(TokenType.SEMICOLON, "Expected ';' after 'break'");
    return { kind: "BreakStatement", line: token.line };
  }

  private parseContinueStatement(): ContinueStatement {
    const token = this.expect(TokenType.CONTINUE, "Expected 'continue'");
    this.expect(TokenType.SEMICOLON, "Expected ';' after 'continue'");
    return { kind: "ContinueStatement", line: token.line };
  }

  private parseBlockStatement(): BlockStatement {
    const braceToken = this.peek();
    const statements = this.parseBlock();

    return {
      kind: "BlockStatement",
      statements,
      line: braceToken.line,
    };
  }

  private parseBlock(): Statement[] {
    this.expect(TokenType.LBRACE, "Expected '{'");
    const statements: Statement[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }

    this.expect(TokenType.RBRACE, "Expected '}'");
    return statements;
  }

  private parseExpressionStatement(): ExpressionStatement {
    const expr = this.parseExpression();
    const line = expr.line;
    this.expect(TokenType.SEMICOLON, "Expected ';' after expression");

    return {
      kind: "ExpressionStatement",
      expression: expr,
      line,
    };
  }

  // ─── Expression Parsing (Precedence Climbing) ────────────────────────

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const expr = this.parseTernary();

    if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN, TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN)) {
      const op = this.previous();
      const value = this.parseAssignment(); // right-associative

      if (expr.kind === "Identifier") {
        if (op.type === TokenType.ASSIGN) {
          return {
            kind: "AssignExpr",
            name: expr.name,
            value,
            line: expr.line,
          };
        } else {
          return {
            kind: "CompoundAssignExpr",
            name: expr.name,
            operator: op.lexeme,
            value,
            line: expr.line,
          };
        }
      }

      throw this.error(this.previous(), "Invalid assignment target");
    }

    return expr;
  }

  private parseTernary(): Expression {
    let expr = this.parseOr();

    if (this.match(TokenType.QUESTION)) {
      const condition = expr;
      const consequence = this.parseExpression();
      this.expect(TokenType.COLON, "Expected ':' after ternary consequence");
      const alternative = this.parseTernary(); // Right-associative
      return {
        kind: "TernaryExpr",
        condition,
        consequence,
        alternative,
        line: condition.line,
      };
    }

    return expr;
  }

  private parseOr(): Expression {
    let left = this.parseAnd();

    while (this.match(TokenType.OR)) {
      const op = this.previous().lexeme;
      const right = this.parseAnd();
      left = { kind: "BinaryExpr", operator: op, left, right, line: left.line };
    }

    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseEquality();

    while (this.match(TokenType.AND)) {
      const op = this.previous().lexeme;
      const right = this.parseEquality();
      left = { kind: "BinaryExpr", operator: op, left, right, line: left.line };
    }

    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();

    while (this.match(TokenType.EQUAL, TokenType.NOT_EQUAL)) {
      const op = this.previous().lexeme;
      const right = this.parseComparison();
      left = { kind: "BinaryExpr", operator: op, left, right, line: left.line };
    }

    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseTerm();

    while (this.match(TokenType.LESS, TokenType.LESS_EQUAL, TokenType.GREATER, TokenType.GREATER_EQUAL)) {
      const op = this.previous().lexeme;
      const right = this.parseTerm();
      left = { kind: "BinaryExpr", operator: op, left, right, line: left.line };
    }

    return left;
  }

  private parseTerm(): Expression {
    let left = this.parseFactor();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.previous().lexeme;
      const right = this.parseFactor();
      left = { kind: "BinaryExpr", operator: op, left, right, line: left.line };
    }

    return left;
  }

  private parseFactor(): Expression {
    let expr = this.parsePower();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const op = this.previous();
      const right = this.parsePower();
      expr = {
        kind: "BinaryExpr",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line,
      };
    }

    return expr;
  }

  private parsePower(): Expression {
    let expr = this.parseUnary();
    if (this.match(TokenType.POWER)) {
      const op = this.previous();
      const right = this.parsePower(); // right-associative
      return {
        kind: "BinaryExpr",
        operator: op.lexeme,
        left: expr,
        right,
        line: op.line,
      };
    }
    return expr;
  }

  private parseUnary(): Expression {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const op = this.previous().lexeme;
      const operand = this.parseUnary(); // right-recursive for right-assoc
      return { kind: "UnaryExpr", operator: op, operand, line: this.previous().line };
    }

    return this.parseCall();
  }

  private parseCall(): Expression {
    let expr = this.parsePrimary();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.match(TokenType.LPAREN)) {
        // Function call
        const args = this.parseArgList();
        this.expect(TokenType.RPAREN, "Expected ')' after arguments");
        expr = { kind: "CallExpr", callee: expr, args, line: expr.line };
      } else if (this.match(TokenType.DOT)) {
        // Member access
        const propToken = this.expect(TokenType.IDENTIFIER, "Expected property name after '.'");
        expr = { kind: "MemberExpr", object: expr, property: propToken.lexeme, line: expr.line };
      } else if (this.match(TokenType.LBRACKET)) {
        // Index access
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET, "Expected ']' after index");
        expr = { kind: "IndexExpr", object: expr, index, line: expr.line };
      } else {
        break;
      }
    }

    if (this.match(TokenType.PLUS_PLUS, TokenType.MINUS_MINUS)) {
      const op = this.previous();
      if (expr.kind === "Identifier") {
        return { kind: "UpdateExpr", name: expr.name, operator: op.lexeme, line: expr.line };
      }
      throw this.error(op, "Invalid update target");
    }

    return expr;
  }

  private parsePrimary(): Expression {
    const token = this.peek();

    // Number literal
    if (this.match(TokenType.NUMBER)) {
      return { kind: "NumberLiteral", value: token.literal as number, line: token.line };
    }

    // String literal
    if (this.match(TokenType.STRING)) {
      return { kind: "StringLiteral", value: token.literal as string, line: token.line };
    }

    // Boolean literals
    if (this.match(TokenType.TRUE)) {
      return { kind: "BooleanLiteral", value: true, line: token.line };
    }
    if (this.match(TokenType.FALSE)) {
      return { kind: "BooleanLiteral", value: false, line: token.line };
    }

    // Null literal
    if (this.match(TokenType.NULL)) {
      return { kind: "NullLiteral", line: token.line };
    }

    // Identifier
    if (this.match(TokenType.IDENTIFIER)) {
      return { kind: "Identifier", name: token.lexeme, line: token.line };
    }

    // Grouped expression
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }

    // Anonymous function expression:  fn(a, b) { ... }
    if (this.match(TokenType.FN)) {
      const params = this.parseParams();
      const body = this.parseBlock();
      return { kind: "FunctionExpr", params, body, line: token.line };
    }

    // Object Literal
    if (this.match(TokenType.LBRACE)) {
      const line = this.previous().line;
      const properties: { key: string; value: Expression }[] = [];
      if (!this.check(TokenType.RBRACE)) {
        do {
          if (this.match(TokenType.SPREAD)) {
            const spreadLine = this.previous().line;
            const operand = this.parseExpression();
            properties.push({ key: "...", value: { kind: "SpreadExpr", operand, line: spreadLine } });
          } else {
            const keyToken = this.match(TokenType.IDENTIFIER, TokenType.STRING) 
              ? this.previous() 
              : this.expect(TokenType.IDENTIFIER, "Expected property name");
            
            const keyStr = keyToken.type === TokenType.STRING ? (keyToken.literal as string) : keyToken.lexeme;
            this.expect(TokenType.COLON, "Expected ':' after property name");
            const value = this.parseExpression();
            properties.push({ key: keyStr, value });
          }
        } while (this.match(TokenType.COMMA));
      }
      this.expect(TokenType.RBRACE, "Expected '}' after object properties");
      return { kind: "ObjectLiteral", properties, line };
    }

    // Array Literal
    if (this.match(TokenType.LBRACKET)) {
      const line = this.previous().line;
      const elements: Expression[] = [];
      if (!this.check(TokenType.RBRACKET)) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }
      this.expect(TokenType.RBRACKET, "Expected ']' after array elements");
      return { kind: "ArrayLiteral", elements, line };
    }

    // Spread Expression
    if (this.match(TokenType.SPREAD)) {
      const line = this.previous().line;
      const operand = this.parseExpression();
      return { kind: "SpreadExpr", operand, line };
    }

    throw this.error(token, `Unexpected token '${token.lexeme}'`);
  }

  // ─── Helper: Parse Parameter List ────────────────────────────────────

  private parseParams(): string[] {
    this.expect(TokenType.LPAREN, "Expected '(' for parameter list");
    const params: string[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        const paramToken = this.expect(TokenType.IDENTIFIER, "Expected parameter name");
        params.push(paramToken.lexeme);
      } while (this.match(TokenType.COMMA));
    }

    this.expect(TokenType.RPAREN, "Expected ')' after parameters");
    return params;
  }

  private parseArgList(): Expression[] {
    const args: Expression[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    return args;
  }

  // ─── Token Helpers ───────────────────────────────────────────────────

  private peek(): Token {
    return this.tokens[this.current]!;
  }

  private peekNext(): Token {
    if (this.current + 1 >= this.tokens.length) return this.tokens[this.tokens.length - 1]!;
    return this.tokens[this.current + 1]!;
  }

  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();

    const token = this.peek();
    throw this.error(token, message);
  }

  private error(token: Token, message: string): ParseError {
    return new ParseError(
      `${message} (got '${token.lexeme}')`,
      token.line,
      token.column,
    );
  }
}
