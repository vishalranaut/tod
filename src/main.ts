#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Interpreter } from "./interpreter.js";
import { LexError, ParseError, RuntimeError, formatError } from "./errors.js";
import { startRepl } from "./repl.js";
import { todStringify } from "./values.js";

// ─── CLI Entrypoint ──────────────────────────────────────────────────────────

const VERSION = "0.1.0";

const HELP = `
  tod — a tiny backend scripting language

  Usage:
    tod                     Launch interactive REPL
    tod run <file.tod>      Execute a TOD script file
    tod eval "<code>"       Evaluate inline TOD code
    tod --version           Show version
    tod --help              Show this help

  Examples:
    tod run hello.tod
    tod eval "log(1 + 2);"
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await startRepl();
    return;
  }

  const command = args[0];

  switch (command) {
    case "--version":
    case "-v":
      console.log(`tod v${VERSION}`);
      break;

    case "--help":
    case "-h":
      console.log(HELP);
      break;

    case "run": {
      const filePath = args[1];
      if (!filePath) {
        console.error("Error: Missing file path. Usage: tod run <file.tod>");
        process.exit(1);
      }
      runFile(filePath);
      break;
    }

    case "eval": {
      const code = args[1];
      if (!code) {
        console.error("Error: Missing code. Usage: tod eval \"<code>\"");
        process.exit(1);
      }
      runCode(code, "<eval>");
      break;
    }

    default:
      // If the argument looks like a file path, try to run it
      if (command && (command.endsWith(".tod") || command.endsWith(".TOD"))) {
        runFile(command);
      } else {
        console.error(`Unknown command: ${command}`);
        console.error("Run 'tod --help' for usage information.");
        process.exit(1);
      }
      break;
  }
}

function runFile(filePath: string): void {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    console.error(`Error: File not found: ${resolved}`);
    process.exit(1);
  }

  const source = fs.readFileSync(resolved, "utf-8");
  runCode(source, resolved);
}

function runCode(source: string, filename: string): void {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const program = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.interpret(program);

    // If running in eval mode and there's a result, print it
    if (filename === "<eval>" && result !== null) {
      console.log(todStringify(result));
    }
  } catch (error) {
    if (error instanceof LexError || error instanceof ParseError || error instanceof RuntimeError) {
      console.error(formatError(error, source));
      process.exit(1);
    }
    throw error;
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
