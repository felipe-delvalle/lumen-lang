# Velocity Ledger

Tracks how fast a language feature moves from "the friction is captured as a failing test"
to "it is fully landed across every layer the language guarantees" (interpreter, both
native emitters, the self-hosted compiler, and any oracle/kernel gate the feature warrants).
This is the loop's own speedometer: the manifesto's promise is that Lumen improves from how
it is used, and this ledger is the receipt that the loop actually closes, with a wall-clock
number attached instead of a vibe.

A feature earns a row the moment its failing-first test commits (see `docs/DESIGN.md` /
`AGENTS.md` for the failing-test-first discipline). It is marked landed only once every
layer the feature touches is bit-identical/parity-gated: the seed interpreter, `emit_fn.lm`
(native C emitter), `emit_llvm.lm` (LLVM emitter), and `lumenc.lm` (the self-hosted
compiler), plus a domain oracle gate for anything numeric (Python or a first-principles
proof, matching the `/quant` discipline this repo already holds itself to for pricing code).

| # | Feature | Failing-test commit | Date opened | Landed commit | Date landed | Wall-clock |
|---|---------|---------------------|-------------|----------------|-------------|------------|
| 1 | exact-decimal `Dec` type (1.50d, i64 scale 1e-6, DPUSH/DFROMI/DADD/DSUB/DMUL/DDIV/D2TEXT, dec_div, dec_to_text, dec_to_float) | [`08523ec1432761dfa80ddd73aba7cfd9d01cc8b6`](../../commit/08523ec1432761dfa80ddd73aba7cfd9d01cc8b6) (`test(seed): failing decimal Dec cases (D1, failing-first)`) | 2026-07-14 | pending-D5 | pending-D5 | pending-D5 |

## Scope of entry #1 (D1 only; D2-D5 continue the row above)

D1 landed the seed (WAT) front-end and interpreter only: lexer (`1.50d` literals), typechecker
(coercion + the Float/Dec-never-mix and `/`-banned-on-Dec diagnostics), IR emission, and the
interpreter's exact/overflow-checked arithmetic (opcodes 64-70, strictly additive, nothing
renumbered). It is the reference oracle every later layer is gated against.

Still open before this row can read "landed":
- **D2** `emit_fn.lm` (native C emitter) lowering for ops 64-70 + `native_decimal_test`.
- **D3** `emit_llvm.lm` (LLVM emitter) lowering + `llvm_decimal_test`.
- **D4** `lumenc.lm` (self-hosted compiler) decimal front-end parity + census + bootstrap
  regen (`native/lumenc.bootstrap.c`).
- **D5** a Python-oracle gate for Dec specifically (independent of D1's own oracle-checked
  test vectors), an accrual/pricing kernel exercising it for real, `LANGUAGE.md` update, and
  this ledger's landed/date/wall-clock cells filled in.

`mu/examples/decimal.lm` is the flagship program (D1's own report has its exact stdout,
Python-oracle-verified digit for digit); it is intentionally NOT yet registered in
`seed/corpus.mjs` (see D1's file-scope notes) because the native emitters do not know ops
64-70 until D2/D3 land, and adding it early would break the native corpus-parity gates.
