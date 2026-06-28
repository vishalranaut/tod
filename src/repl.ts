import * as readline from "node:readline";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Interpreter } from "./interpreter.js";
import { LexError, ParseError, RuntimeError, formatError } from "./errors.js";
import { todStringify } from "./values.js";

// ─── REPL ────────────────────────────────────────────────────────────────────

const BANNER = `
  ╔══════════════════════════════════╗
  ║    TOD v0.1.0 — REPL            ║
  ║    Type .help for commands       ║
  ║    Type .exit to quit            ║
  ╚══════════════════════════════════╝
`;

export async function startRepl(): Promise<void> {
  console.log(BANNER);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "tod> ",
  });

  const interpreter = new Interpreter();
  let inputBuffer = "";
  let braceDepth = 0;

  rl.prompt();

  rl.on("line", (line: string) => {
    const trimmed = line.trim();

    // REPL commands
    if (trimmed === ".exit" || trimmed === ".quit") {
      console.log("Goodbye!");
      rl.close();
      return;
    }

    if (trimmed === ".help") {
      console.log("  .exit    Exit the REPL");
      console.log("  .clear   Clear the screen");
      console.log("  .help    Show this help message");
      console.log("");
      rl.prompt();
      return;
    }

    if (trimmed === ".clear") {
      console.clear();
      rl.prompt();
      return;
    }

    // Accumulate input for multi-line support
    inputBuffer += (inputBuffer ? "\n" : "") + line;

    // Track brace depth for multi-line input
    for (const ch of line) {
      if (ch === "{") braceDepth++;
      if (ch === "}") braceDepth--;
    }

    // If braces are unbalanced, continue reading
    if (braceDepth > 0) {
      rl.setPrompt("...  ");
      rl.prompt();
      return;
    }

    // Try to execute the accumulated input
    const source = inputBuffer;
    inputBuffer = "";
    braceDepth = 0;
    rl.setPrompt("tod> ");

    if (source.trim() === "") {
      rl.prompt();
      return;
    }

    try {
      // In REPL mode, auto-add semicolon if missing for bare expressions
      let code = source;
      const trimmedCode = code.trim();
      if (
        !trimmedCode.endsWith(";") &&
        !trimmedCode.endsWith("}") &&
        !trimmedCode.startsWith("fn ") &&
        !trimmedCode.startsWith("if ") &&
        !trimmedCode.startsWith("while ")
      ) {
        code = code + ";";
      }

      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();
      const result = interpreter.interpret(program);

      // Print the result of the last expression (unless it's null or was printed by log)
      if (result !== null) {
        console.log(todStringify(result));
      }
    } catch (error) {
      if (error instanceof LexError || error instanceof ParseError || error instanceof RuntimeError) {
        console.error(formatError(error, source));
      } else {
        throw error;
      }
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });

  // Wait forever (REPL loop runs via events)
  return new Promise(() => {});
}
