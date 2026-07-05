# TOD 🔥

**A tiny backend scripting language** — dynamically typed, built in TypeScript, designed for fun.

```
let name = "TOD";
fn greet(user) {
  return "hello " + user;
}
log(greet("world"));  // → hello world
```

## Features

- **C/JS-like syntax** — `let`, `const`, `fn`, `if`/`else`, `while`, `for`, `break`, `continue`
- **Dynamic typing** — variables can hold numbers, strings, booleans, null, functions
- **First-class functions** — closures, higher-order functions, anonymous `fn` expressions
- **Lexical scoping** — proper scope chains with variable shadowing
- **Built-in standard library** — `log`, `json`, file I/O, math, type utilities
- **Interactive REPL** — with multi-line input support
- **Zero runtime dependencies** — pure TypeScript

## Install

```bash
# Install globally — adds the `tod` command to your PATH
npm install -g todlang

# Or install locally in a project
npm install todlang
```

## Quick Start

```bash
# Launch the REPL
tod

# Run a script
tod run hello.tod

# Evaluate inline code
tod eval "log(1 + 2);"
```

### Use as a Library

```typescript
import { Lexer, Parser, Interpreter } from "todlang";

const source = 'let x = 40 + 2; log(x);';
const tokens = new Lexer(source).tokenize();
const program = new Parser(tokens).parse();
const interpreter = new Interpreter();
interpreter.interpret(program);
// → 42
```

## CLI Usage

```
tod                     Launch interactive REPL
tod run <file.tod>      Execute a TOD script file
tod eval "<code>"       Evaluate inline TOD code
tod --version           Show version
tod --help              Show this help
```

## Language Guide

### Variables

```tod
let x = 42;
const name = "TOD";
let active = true;

x = x + 1;  // reassignment
x += 5;     // compound assignment
x++;        // increment
```

### Functions

```tod
fn add(a, b) {
  return a + b;
}
log(add(2, 3));  // → 5

// Anonymous functions & closures
let double = fn(x) { return x * 2; };
log(double(21));  // → 42
```

### Control Flow

```tod
if (x > 0) {
  log("positive");
} else if (x == 0) {
  log("zero");
} else {
  log("negative");
}

let i = 0;
while (i < 10) {
  if (i == 5) { break; }
  log(i);
  i++;
}

for (let j = 0; j < 3; j++) {
  if (j == 1) { continue; }
  log(j);
}
```

### Object-Oriented Programming (OOP)

TOD fully supports classes, inheritance, and the `instanceof` operator.

```typescript
class Animal {
  constructor(name) {
    this.name = name;
  }
  
  speak() {
    log(this.name + " makes a noise.");
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // Call superclass constructor
    this.breed = breed;
  }
  
  speak() {
    super.speak(); // Call superclass method
    log(this.name + " barks.");
  }
}

let d = new Dog("Rex", "German Shepherd");
d.speak();
// Output:
// Rex makes a noise.
// Rex barks.

log(d instanceof Dog);    // true
log(d instanceof Animal); // true
```

### Advanced OOP (`static` and Getters/Setters)

TOD supports static methods and getter/setter accessors.

```typescript
class MathUtils {
  static add(a, b) {
    return a + b;
  }
}

log(MathUtils.add(5, 7)); // 12

class Person {
  constructor(first, last) {
    this.first = first;
    this.last = last;
  }
  
  get fullName() {
    return this.first + " " + this.last;
  }
  
  set fullName(name) {
    this.first = name;
    this.last = "";
  }
}

let p = new Person("John", "Doe");
log(p.fullName); // John Doe
p.fullName = "Jane";
log(p.first); // Jane
```

### Arrays and Objects

```tod
let arr = [1, 2, 3];
let obj = { a: 1, b: 2 };

// Spread operator
let combined = [...arr, 4, 5];
let merged = { ...obj, c: 3 };
```

### Operators

| Category     | Operators                  |
|-------------|---------------------------|
| Arithmetic  | `+` `-` `*` `/` `%` `**` |
| Assignment  | `=` `+=` `-=` `*=` `/=` `%=` |
| Update      | `++` `--`                 |
| Comparison  | `==` `!=` `<` `>` `<=` `>=` |
| Logical     | `&&` `\|\|` `!`          |
| Ternary     | `? :`                     |
| Spread      | `...`                     |

### Built-in Functions

| Function           | Description                              |
|-------------------|------------------------------------------|
| `log(...args)`    | Print to console                         |
| `type(val)`       | Get type name ("number", "string", etc.) |
| `len(val)`        | String or array length                   |
| `toString(val)`   | Convert to string                        |
| `toNumber(val)`   | Parse to number                          |
| `floor(n)`        | Floor a number                           |
| `ceil(n)`         | Ceiling a number                         |
| `abs(n)`          | Absolute value                           |
| `random()`        | Random number [0, 1)                     |
| `time()`          | Current timestamp (ms)                   |
| `env(key)`        | Read environment variable                |
| `readFile(path)`  | Read file as string                      |
| `writeFile(p, d)` | Write string to file                     |
| `json.parse(str)` | Parse JSON string                        |
| `json.stringify(v)`| Serialize to JSON                       |
| `exit(code?)`     | Exit process                             |

## Grammar (EBNF)

```ebnf
Program     ::= Statement*
Statement   ::= LetStmt | ConstStmt | FnDecl | ReturnStmt | IfStmt | WhileStmt | ForStmt | BreakStmt | ContinueStmt | Block | ExprStmt
LetStmt     ::= "let" IDENT "=" Expr ";"
ConstStmt   ::= "const" IDENT "=" Expr ";"
FnDecl      ::= "fn" IDENT "(" Params? ")" "{" Statement* "}"
ReturnStmt  ::= "return" Expr? ";"
IfStmt      ::= "if" "(" Expr ")" Block ( "else" (IfStmt | Block) )?
WhileStmt   ::= "while" "(" Expr ")" Block
ForStmt     ::= "for" "(" (LetStmt | ConstStmt | ExprStmt | ";") Expr? ";" Expr? ")" Block
BreakStmt   ::= "break" ";"
ContinueStmt::= "continue" ";"
Block       ::= "{" Statement* "}"
ExprStmt    ::= Expr ";"

Expr        ::= Assignment
Assignment  ::= ( IDENT ( "=" | "+=" | "-=" | "*=" | "/=" | "%=" ) Assignment ) | Ternary
Ternary     ::= Or ( "?" Expr ":" Ternary )?
Or          ::= And ( "||" And )*
And         ::= Equality ( "&&" Equality )*
Equality    ::= Comparison ( ( "==" | "!=" ) Comparison )*
Comparison  ::= Term ( ( "<" | ">" | "<=" | ">=" ) Term )*
Term        ::= Factor ( ( "+" | "-" ) Factor )*
Factor      ::= Power ( ( "*" | "/" | "%" ) Power )*
Power       ::= Unary ( "**" Power )?
Unary       ::= ( "!" | "-" ) Unary | Call
Call        ::= Primary ( "(" ArgList? ")" | "." IDENT | "[" Expr "]" )* ( "++" | "--" )?
Primary     ::= NUMBER | STRING | "true" | "false" | "null"
              | IDENT | "(" Expr ")" | "fn" "(" Params? ")" Block
              | "[" (Expr | "..." Expr) ("," (Expr | "..." Expr))* "]"
              | "{" (IDENT ":" Expr | "..." Expr) ("," (IDENT ":" Expr | "..." Expr))* "}"
```

## Development

```bash
npm run build        # Compile TypeScript
npm test             # Run test suite
npm run test:watch   # Watch mode
npm run typecheck    # Type check only
```

## Architecture

```
Source code → Lexer → Tokens → Parser → AST → Interpreter → Output
```

| File             | Responsibility                        |
|-----------------|---------------------------------------|
| `src/token.ts`  | Token types and keyword map           |
| `src/lexer.ts`  | Source text → token stream            |
| `src/ast.ts`    | AST node type definitions             |
| `src/parser.ts` | Recursive-descent parser              |
| `src/values.ts` | Runtime value types and utilities     |
| `src/environment.ts` | Lexical scope / variable store   |
| `src/interpreter.ts` | Tree-walk AST evaluator          |
| `src/builtins.ts` | Standard library functions          |
| `src/errors.ts` | Error types (Lex, Parse, Runtime)     |
| `src/repl.ts`   | Interactive REPL                      |
| `src/main.ts`   | CLI entrypoint                        |

## License

MIT
