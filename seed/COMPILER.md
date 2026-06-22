# lumenc: the stage-0 Lumen-mu compiler (working)

`lumenc.wat` is a real compiler, written in WebAssembly text (a compilation substrate, not a legacy high-level language, so zero-legacy holds). It takes Lumen-mu **source text** and produces the Lumen-mu IR, then runs it on the built-in bytecode interpreter. This is the walking skeleton the roadmap calls for: source in, correct output out, end to end, with no legacy language anywhere in the pipeline.

## Pipeline

```
source text (host writes bytes into the SRC region)
  -> $lex          tokenizer (idents, ints, operators, comments, keywords)
  -> $c_program    recursive-descent parser that EMITS IR directly
                   (precedence ladder cmp -> add -> mul -> primary;
                    JZ/JMP backpatching for if/else; a function symbol table)
  -> IR words      (the Lumen-mu IR, in the CODE region)
  -> $run          the bytecode interpreter (operand stack + call stack)
  -> output        via the single Console seam
```

The compiler and the interpreter are the same module; `compile_and_run(srclen)` does both. `compile(srclen)` returns the IR word count; `run(entry)` executes; `dbg_*` expose token/IR/entry counts.

## Verified results

Conformance (`node test.mjs`):

```
PASS  fib_print.lm  -> "55\n"   (ir_words=35)
PASS  add.lm        -> "42\n"   (ir_words=15)
PASS  max.lm        -> "13\n"   (ir_words=24)
PASS  fact.lm       -> "120\n"  (ir_words=29)

4/4 Lumen-mu programs compiled from source and ran correctly.
```

These exercise: recursion, multi-argument calls, `if`/`else` (with jump backpatching), and the full integer arithmetic set (`+ - * / <`). A strong correctness signal: the compiler emits the SAME 35 IR words for `fib` that the hand-written `fib.lmir` does, byte for byte.

Performance (`node bench.mjs`, fib(30) = 832040):

```
compile source->IR:       ~0.24 ms   (35 IR words)
run (interpret fib(30)):  ~200 ms
~2.69 M function calls  ->  ~13.5 M calls/sec on the bytecode interpreter
```

This is the bootstrap interpreter's speed. The "fastest, most optimized" target is delivered later by the native backend (roadmap Phase 4: Cranelift for debug, LLVM for release), which compiles the same IR to machine code and is expected to be one to two orders of magnitude faster. The interpreter exists to bootstrap, not to be fast.

## Subset compiled today

`fn`, parameters, `if`/`else`, `return`, integer literals, `+ - * / <`, function calls (define-before-use), and `console.print_int(expr)`. The grammar is a strict subset of `../docs/spec/GRAMMAR.md`.

Not yet: `let`/locals, `Text`, sum and record types, `Result`/`?`, and forward references (a fixup table for calls to later-defined functions). These are the next increments. After enough of them land, the goal is to rewrite this compiler IN Lumen-mu and run it on the seed, reaching the self-hosting fixpoint.

## How it was built

Written and verified directly (the multi-agent workflow was rate-limited). One real bug was found and fixed during bring-up: `$streq` returned "equal" for every comparison (a mis-targeted branch), which made the symbol and parameter tables always resolve to their first entry. `fib` passed anyway by luck (single parameter, first symbol); `add` and `max` exposed it (`add(20,22)` gave 40, `max(7,13)` gave 7). The fix made all four programs correct. The episode is a small live demonstration of the project's own thesis: a deterministic, inspectable pipeline made the bug reproducible and the fix verifiable.
