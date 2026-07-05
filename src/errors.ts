// ─── Error Types ─────────────────────────────────────────────────────────────

/**
 * Error thrown during lexical analysis (scanning).
 */
export class LexError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`[Lex Error] Line ${line}, Col ${column}: ${message}`);
    this.name = "LexError";
  }
}

/**
 * Error thrown during parsing (syntax analysis).
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`[Parse Error] Line ${line}, Col ${column}: ${message}`);
    this.name = "ParseError";
  }
}

/**
 * Error thrown during interpretation (runtime).
 */
export class RuntimeError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
  ) {
    const prefix = line !== undefined ? `[Runtime Error] Line ${line}: ` : "[Runtime Error] ";
    super(`${prefix}${message}`);
    this.name = "RuntimeError";
  }
}

/**
 * Control-flow signal used to unwind the call stack on `return` statements.
 * Not a real error — caught by function call handlers.
 */
export class ReturnSignal extends Error {
  constructor(public readonly value: unknown) {
    super("return");
    this.name = "ReturnSignal";
  }
}

/**
 * Control-flow signal for `break` statements.
 */
export class BreakSignal extends Error {
  constructor() {
    super("break");
    this.name = "BreakSignal";
  }
}

/**
 * Control-flow signal for `continue` statements.
 */
export class ContinueSignal extends Error {
  constructor() {
    super("continue");
    this.name = "ContinueSignal";
  }
}

// ─── Error Formatter ─────────────────────────────────────────────────────────

/**
 * Formats a TOD error into a user-friendly string, optionally highlighting
 * the offending line in the source.
 */
export function formatError(error: LexError | ParseError | RuntimeError, source?: string): string {
  const lines: string[] = [error.message];

  if (source) {
    const sourceLines = source.split("\n");
    let lineNum: number | undefined;

    if (error instanceof LexError || error instanceof ParseError) {
      lineNum = error.line;
    } else if (error instanceof RuntimeError) {
      lineNum = error.line;
    }

    if (lineNum !== undefined && lineNum >= 1 && lineNum <= sourceLines.length) {
      const line = sourceLines[lineNum - 1];
      lines.push("");
      lines.push(`  ${lineNum} | ${line}`);

      if ((error instanceof LexError || error instanceof ParseError) && error.column >= 1) {
        const padding = " ".repeat(String(lineNum).length + 3 + error.column - 1);
        lines.push(`${padding}^`);
      }
    }
  }

  return lines.join("\n");
}
