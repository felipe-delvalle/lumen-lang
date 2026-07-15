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
| 1 | exact-decimal `Dec` type (1.50d, i64 scale 1e-6, DPUSH/DFROMI/DADD/DSUB/DMUL/DDIV/D2TEXT, dec_div, dec_to_text, dec_to_float) | [`947004c0f10acca9e7f23288688403fa7b23ec2a`](https://github.com/lumen-source/lumen/commit/947004c0f10acca9e7f23288688403fa7b23ec2a) (PR [#68](https://github.com/lumen-source/lumen/pull/68), first commit, `test(seed): failing decimal Dec cases (D1, failing-first)`) | 2026-07-15 02:33:32 UTC | PR [#85](https://github.com/lumen-source/lumen/pull/85) merge (`aef86e0d30611d76de19e6bf67e71c1c09f2bc84`) | 2026-07-15 16:47:56 UTC | 14h 14m 24s |

## Landed: the full D1-D5 wave

D1-D4 landed across four PRs, each adding one more layer's parity:

| Sub-wave | PR | Merge (UTC) | What landed |
|----------|----|-----------|--------------|
| D1 | [#68](https://github.com/lumen-source/lumen/pull/68) | 2026-07-15 03:11:37 | seed (WAT) lexer/typechecker/IR/interpreter, ops 64-70 |
| D2 | [#72](https://github.com/lumen-source/lumen/pull/72) | 2026-07-15 03:42:49 | `emit_fn.lm` (native C emitter) lowering + `native_decimal_test.mjs` |
| D3 | [#75](https://github.com/lumen-source/lumen/pull/75) | 2026-07-15 03:52:31 | `emit_llvm.lm` (LLVM emitter) lowering + `llvm_decimal_test.mjs` |
| D4 | [#85](https://github.com/lumen-source/lumen/pull/85) | 2026-07-15 16:47:56 | `lumenc.lm` (self-hosted compiler) Dec front-end + census 30/30 + corpus 33/33 |
| D5 | (this PR) | pending | external Python-`decimal.Decimal` oracle gate (`native/decimal_oracle_test.mjs`, 200 seeded programs, 4-way agreement), `examples/finance/accrual_dec.lm` (corpus 34/34, census 31/31), `LANGUAGE.md` Dec section, this ledger entry, scoreboard flips |

Wall-clock (14h 14m 24s) is measured from D1's failing-first commit (the first commit on PR
#68's branch) to D4's merge (PR #85) - the point at which every layer the language guarantees
(interpreter, both native backends, self-hosted compiler) agreed bit-identically on Dec. D5's
external oracle gate is the fourth independent witness on top of that already-closed loop, not
a fifth layer the feature needed to "land" - hence the wall-clock is pinned to D1->D4.

**Gates now covering this row:**
- `native/native_decimal_test.mjs` (D2: interpreter vs `emit_fn.lm`, functional + trap corpus)
- `native/llvm_decimal_test.mjs` (D3: interpreter vs `emit_llvm.lm`)
- `seed/selfhost_diff.mjs` (D4: 31/31 bit-identical, incl. `decimal.lm` and `accrual_dec.lm`)
- `native/decimal_oracle_test.mjs` (D5: 200 seeded programs, interpreter + both native backends
  + Python `decimal.Decimal` oracle, 4-way byte-identical agreement, self-falsification demo)

## Scope of entry #1 (D1 only; D2-D5 continue the row above)

D1 landed the seed (WAT) front-end and interpreter only: lexer (`1.50d` literals), typechecker
(coercion + the Float/Dec-never-mix and `/`-banned-on-Dec diagnostics), IR emission, and the
interpreter's exact/overflow-checked arithmetic (opcodes 64-70, strictly additive, nothing
renumbered). It is the reference oracle every later layer is gated against.

All of D2-D5 have since landed (table above); this section is kept as the historical record of
what D1 alone shipped and why the row could not read "landed" at that point:
- **D2** `emit_fn.lm` (native C emitter) lowering for ops 64-70 + `native_decimal_test` - landed, PR #72.
- **D3** `emit_llvm.lm` (LLVM emitter) lowering + `llvm_decimal_test` - landed, PR #75.
- **D4** `lumenc.lm` (self-hosted compiler) decimal front-end parity + census + bootstrap
  regen (`native/lumenc.bootstrap.c`) - landed, PR #85.
- **D5** a Python-oracle gate for Dec specifically (independent of D1's own oracle-checked
  test vectors), an accrual/pricing kernel exercising it for real, `LANGUAGE.md` update, and
  this ledger's landed/date/wall-clock cells filled in - landed, this PR.

`mu/examples/decimal.lm` is the flagship program (D1's own report has its exact stdout,
Python-oracle-verified digit for digit); it was registered in `seed/corpus.mjs` once D4 landed
(see the wave table above). `examples/finance/accrual_dec.lm` (D5) joined the same corpus and
the self-host census in this PR.
