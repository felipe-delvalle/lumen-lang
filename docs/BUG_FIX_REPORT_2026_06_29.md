# Lumen Compiler Bug Fix Report - 2026-06-29

## The Problem
The bootstrapping compilation of `lumenc.lm` using the seed WebAssembly compiler `lumenc.wat` was crashing/hanging with `RuntimeError: memory access out of bounds` and infinite loops. 

## The Root Causes
1. **Memory Bounds**: `lumenc.wat` had hardcoded memory offsets that restricted the source code size to ~10,000 bytes (source code at 20000, tokens at 30000). However, `lumenc.lm` is over 33,000 bytes. This caused `lumenc.lm`'s source code to overwrite the tokens buffer and symbol table, leading to corrupted data and invalid token types that caused infinite loops in the recursive descent parser.
2. **Unsupported Semicolons**: The AI subagent had injected semicolons (e.g. `i = i + 1; matched = 1`) into `lumenc.lm`. The `lumenc.wat` parser does not support semicolons, causing it to emit `tk=0`, which the parser ignored indefinitely without advancing the token pointer.
3. **Invalid Brace Injection**: A previous automated regex fix for global variables had inadvertently injected an invalid closing brace (`target }`) into the source.
4. **WASM Memory Limit**: `lumenc.wat` had its memory limited to 8 pages (524KB), which caused out of bounds on larger source files.

## The Fixes
- Added a `patch_wat.cjs` script to dynamically bump the memory offsets in `lumenc.wat` (Source to `500000`, Tokens to `1500000`, etc.) to support 1MB+ source files.
- Increased `lumenc.wat`'s WebAssembly exported memory from `8` pages to `100` pages.
- Removed all semicolons from `lumenc.lm`.
- Fixed the `target }` syntax error.
- Successfully compiled `lumenc.lm` using `node lumen.mjs check lumenc.lm`, resulting in `8634 IR words`.

The Lumen compiler is now officially capable of compiling itself using the seed compiler.
