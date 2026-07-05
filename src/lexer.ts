import { Token, TokenType, KEYWORDS } from "./token.js";
import { LexError } from "./errors.js";

// ─── Lexer ───────────────────────────────────────────────────────────────────

export class Lexer {
  private readonly source: string;
  private readonly tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private startColumn = 1;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Scan the entire source string and return an array of tokens.
   * The last token is always EOF.
   */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.startColumn = this.column;
      this.scanToken();
    }

    this.tokens.push({
      type: TokenType.EOF,
      lexeme: "",
      literal: null,
      line: this.line,
      column: this.column,
    });

    return this.tokens;
  }

  // ─── Scanner Core ────────────────────────────────────────────────────

  private scanToken(): void {
    const ch = this.advance();

    switch (ch) {
      // Single-character tokens
      case "(": this.addToken(TokenType.LPAREN); break;
      case ")": this.addToken(TokenType.RPAREN); break;
      case "{": this.addToken(TokenType.LBRACE); break;
      case "}": this.addToken(TokenType.RBRACE); break;
      case "[": this.addToken(TokenType.LBRACKET); break;
      case "]": this.addToken(TokenType.RBRACKET); break;
      case ",": this.addToken(TokenType.COMMA); break;
      case ";": this.addToken(TokenType.SEMICOLON); break;
      case "+":
        if (this.match("=")) {
          this.addToken(TokenType.PLUS_ASSIGN);
        } else if (this.match("+")) {
          this.addToken(TokenType.PLUS_PLUS);
        } else {
          this.addToken(TokenType.PLUS);
        }
        break;
      case "-":
        if (this.match("=")) {
          this.addToken(TokenType.MINUS_ASSIGN);
        } else if (this.match("-")) {
          this.addToken(TokenType.MINUS_MINUS);
        } else {
          this.addToken(TokenType.MINUS);
        }
        break;
      case "*":
        if (this.match("=")) {
          this.addToken(TokenType.STAR_ASSIGN);
        } else if (this.match("*")) {
          this.addToken(TokenType.POWER);
        } else {
          this.addToken(TokenType.STAR);
        }
        break;
      case "%":
        this.addToken(this.match("=") ? TokenType.PERCENT_ASSIGN : TokenType.PERCENT);
        break;

      // Two-character tokens
      case "=":
        this.addToken(this.match("=") ? TokenType.EQUAL : TokenType.ASSIGN);
        break;
      case "!":
        this.addToken(this.match("=") ? TokenType.NOT_EQUAL : TokenType.BANG);
        break;
      case "<":
        this.addToken(this.match("=") ? TokenType.LESS_EQUAL : TokenType.LESS);
        break;
      case ">":
        this.addToken(this.match("=") ? TokenType.GREATER_EQUAL : TokenType.GREATER);
        break;
      case "&":
        if (this.match("&")) {
          this.addToken(TokenType.AND);
        } else {
          throw new LexError(`Unexpected character '&'. Did you mean '&&'?`, this.line, this.startColumn);
        }
        break;
      case "|":
        if (this.match("|")) {
          this.addToken(TokenType.OR);
        } else {
          throw new LexError(`Unexpected character '|'`, this.line, this.current);
        }
        break;
      case "?":
        this.addToken(TokenType.QUESTION);
        break;
      case ":":
        this.addToken(TokenType.COLON);
        break;
      case ".":
        if (this.match(".")) {
          if (this.match(".")) {
            this.addToken(TokenType.SPREAD);
          } else {
            throw new LexError(`Unexpected character '.'`, this.line, this.current);
          }
        } else {
          this.addToken(TokenType.DOT);
        }
        break;

      // Slash: division or comment
      case "/":
        if (this.match("/")) {
          // Line comment — consume until end of line
          while (!this.isAtEnd() && this.peek() !== "\n") {
            this.advance();
          }
        } else if (this.match("=")) {
          this.addToken(TokenType.SLASH_ASSIGN);
        } else {
          this.addToken(TokenType.SLASH);
        }
        break;

      // Whitespace
      case " ":
      case "\r":
      case "\t":
        // Ignore whitespace (column already advanced)
        break;
      case "\n":
        this.line++;
        this.column = 1;
        break;

      // String literals
      case '"':
        this.scanString();
        break;

      default:
        if (this.isDigit(ch)) {
          this.scanNumber();
        } else if (this.isAlpha(ch)) {
          this.scanIdentifier();
        } else {
          throw new LexError(`Unexpected character '${ch}'`, this.line, this.startColumn);
        }
        break;
    }
  }

  // ─── String Scanning ─────────────────────────────────────────────────

  private scanString(): void {
    let value = "";

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === "\n") {
        this.line++;
        this.column = 1;
      }

      if (this.peek() === "\\") {
        this.advance(); // consume backslash
        const escaped = this.advance();
        switch (escaped) {
          case "n":  value += "\n"; break;
          case "t":  value += "\t"; break;
          case "r":  value += "\r"; break;
          case "\\": value += "\\"; break;
          case '"':  value += '"';  break;
          default:
            throw new LexError(`Invalid escape sequence '\\${escaped}'`, this.line, this.column - 1);
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new LexError("Unterminated string literal", this.line, this.startColumn);
    }

    // Consume the closing "
    this.advance();

    this.addToken(TokenType.STRING, value);
  }

  // ─── Number Scanning ──────────────────────────────────────────────────

  private scanNumber(): void {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Look for a decimal part
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      this.advance(); // consume the '.'
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const lexeme = this.source.slice(this.start, this.current);
    this.addToken(TokenType.NUMBER, parseFloat(lexeme));
  }

  // ─── Identifier / Keyword Scanning ────────────────────────────────────

  private scanIdentifier(): void {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const lexeme = this.source.slice(this.start, this.current);
    const keywordType = KEYWORDS.get(lexeme);

    if (keywordType !== undefined) {
      // Keywords with literal values
      let literal: string | number | boolean | null = null;
      if (keywordType === TokenType.TRUE) literal = true;
      else if (keywordType === TokenType.FALSE) literal = false;

      this.addToken(keywordType, literal);
    } else {
      this.addToken(TokenType.IDENTIFIER);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private advance(): string {
    const ch = this.source[this.current]!;
    this.current++;
    this.column++;
    return ch;
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.source[this.current]!;
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return "\0";
    return this.source[this.current + 1]!;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private addToken(type: TokenType, literal: string | number | boolean | null = null): void {
    const lexeme = this.source.slice(this.start, this.current);
    this.tokens.push({
      type,
      lexeme,
      literal,
      line: this.line,
      column: this.startColumn,
    });
  }
}
