// Lumen stage-0 warm-compiler core. Exposes a reusable compile/run/ir surface with the SAME
// shape every caller (lumen.mjs, lumend.mjs, lumen_mcp.mjs, basics.mjs, diagnostics.mjs, and
// every native diff gate) has always depended on: synchronous compile()/run()/ir() returning
// plain objects, never Promises - that contract is preserved exactly across R5.
//
// R5: the WebAssembly engine is retired. compile() now runs the checked-in, reproducible native
// compiler (native/lumenc.bootstrap.c, `clang`-built once and cached - see
// native/native_compile.mjs's compileToIRNativeRaw), a synchronous process-spawn per call
// (~2ms, measured; the resident IPC server is faster but inherently async, and every caller here
// needs a synchronous return, so the daemon/MCP hot loop uses the resident server directly via
// native/native_check.mjs instead - see that file). run()/ir() then execute the resulting IR
// through native/ir_interpreter.mjs: a pure-JS, in-process, zero-wasm port of lumenc.wat's own
// $run function, restoring the sub-millisecond hot path a per-call clang+exec round trip would
// have cost (measured 130-500ms/call - see the R5 PR body for the numbers that ruled that out).
// Zero-legacy note: this host shim is bootstrap scaffolding, re-derived in Lumen at the
// self-hosting fixpoint, same as before.
import { compileToIRNativeRaw } from '../native/native_compile.mjs';
import { createInterpreter, CODE_BASE as INTERP_CODE_BASE } from '../native/ir_interpreter.mjs';

export const SRC_BASE = 100000;
export const SRC_CAPACITY = 70000;   // SRC region is [100000,170000) (D4: raised from 50000 so lumenc.lm's own growth to compile Dec still self-hosts); a longer source overruns into the SYMBOLS region at 170000
export const DIAG_BASE = 286000;   // historical: the RETIRED wasm seed's OWN internal diag address (native's own diag region is now 390000, D4-shifted +100000 from 290000; see native/lumenc_native.mjs's DIAG_BASE comment). Kept exported for any caller still importing it; not load-bearing here.
export const CODE_BASE = 11328;   // emitted IR words - matches native/ir_interpreter.mjs's CODE_BASE

export const OPS = {0:'HALT',1:'PUSH',2:'GETARG',3:'ADD',4:'SUB',5:'LT',6:'JZ',7:'JMP',8:'CALL',
  9:'RET',10:'PRINTINT',11:'MUL',12:'DIV',13:'RESERVE',14:'SETLOCAL',15:'MKTEXT',
  16:'PRINTTEXT',17:'CONCAT',18:'INT2TEXT',19:'EQ',20:'NE',21:'LE',22:'GE',23:'GT',24:'MOD',
  25:'MKSUM',26:'SUMTAG',27:'SUMVAL',28:'TEXTEQ',
  29:'FPUSH',   // float literal (two 32-bit halves, like DPUSH) - was missing a name entirely
  53:'LOAD32',54:'STORE32',55:'LOAD8',56:'STORE8',   // raw-memory keystone (self-host + native emitter/optimizer)
  58:'BAND',59:'BOR',60:'BXOR',61:'SHL',62:'SHR',63:'BNOT',   // bitwise builtins (stack ops, no inline operands)
  64:'DPUSH',65:'DFROMI',66:'DADD',67:'DSUB',68:'DMUL',69:'DDIV',70:'D2TEXT'};   // Dec: exact decimal, i64 scale 1e-6 (D1)

// Canonical fixed-width operand-word count for any opcode EXCEPT TYPEMAP(57), which is
// variable-length ([57, ntot, rettype, type0..type(ntot-1)]: 3+ntot words) and is handled
// separately by every caller, exactly as ir() does below. Single source of truth: exported so
// seed/lumen_mcp.mjs's typesFromSource imports this instead of keeping its own copy - four
// independent instances of this exact table (native/pipeline.mjs, native/optimize.lm, native/
// emit_llvm.lm each missing DPUSH's width at some point during D2/D3; this pair - ir() and
// typesFromSource - missing it going into this fix) is the argument for unifying the two files
// that already share an import line, not for a fifth still-independent copy.
export function oplen(op) {
  if (op === 8 || op === 29 || op === 64) return 2;   // CALL(entry,argc), FPUSH(lo,hi), DPUSH(lo,hi)
  if (op === 1 || op === 2 || op === 6 || op === 7 || op === 13 || op === 14 || op === 15 || op === 25) return 1;
  return 0;
}

// Create a warm compiler. `await createCompiler()` once, reuse forever (the `await` is kept for
// call-site compatibility - every existing caller does `const lumen = await createCompiler()` -
// though nothing inside actually awaits anymore; compile/run/ir are fully synchronous).
export async function createCompiler() {
  const assembleStart = process.hrtime.bigint();
  // No assemble step anymore (there is no WAT to parse), but keep `assembleMs` meaningful: it is
  // the fixed cost of getting the native compiler binary ready, paid once per process via
  // getNativeCompilerBin()'s cache - the very first compile() call below pays it; every caller
  // that reads lumen.assembleMs (lumend.mjs's warm-log line, lumen_mcp.mjs's startup line) still
  // gets an honest "how long until warm" number.
  compileToIRNativeRaw('fn main(c: Console) -> Unit {}\n');   // warm the cached binary build now, not on the caller's first real compile
  const assembleMs = Number(process.hrtime.bigint() - assembleStart) / 1e6;

  // compile only; returns IR metadata + raw diagnostics (never throws on a user error)
  function compile(source) {
    const srclen = Buffer.byteLength(source, 'utf8');
    if (srclen > SRC_CAPACITY) {   // guard: mirrors the wasm seed's SRC-capacity guard (BUG-safe: a too-long source must not silently corrupt anything downstream)
      throw new Error(`source ${srclen}B exceeds SRC capacity ${SRC_CAPACITY}B`);
    }
    let r;
    try { r = compileToIRNativeRaw(source); }
    catch (e) { return { ok: false, irWords: 0, main: 0, srclen, rawDiags: [], crash: String(e.message || e) }; }
    return { ok: r.rawDiags.length === 0, irWords: r.words.length, main: r.main, srclen, rawDiags: r.rawDiags,
      tokens: r.tokens, symbols: r.symbols, words: r.words, strings: r.strings };
  }

  // compile then run; returns stdout (empty if compile produced diagnostics)
  function run(source) {
    const c = compile(source);
    if (!c.ok) return { ...c, stdout: '' };
    const interp = createInterpreter();
    interp.writeCode(c.words);
    interp.seedStrings(c.strings);
    interp.set_fuel_max(4000000000n);
    try { interp.run(c.main); }
    catch (e) { return { ...c, stdout: interp.getOut(), crash: String(e.message || e) }; }
    return { ...c, stdout: interp.getOut() };
  }

  // IR disassembly text (one instruction per line) - reads straight off compile()'s own `words`
  // now, not a second memory peek, so this is simpler AND faster than the wasm version was.
  // TYPEMAP(57) is a variable-length compile-time metadata record, not an instruction the
  // interpreter ever dispatches on at runtime (every other IR consumer in this repo skips it the
  // same way, 3+ntot words); it gets its own line here rather than falling through to the generic
  // path, which would otherwise scatter its ntot/rettype/slot-type payload words across several
  // bogus "instructions".
  function ir(source) {
    const c = compile(source);
    if (!c.ok) return { ...c, text: '' };
    const code = c.words;
    const lines = [];
    let i = 0;
    while (i < c.irWords) {
      const op = code[i];
      if (op === 57) {
        const ntot = code[i + 1];
        const slots = Array.from({ length: ntot }, (_, k) => code[i + 3 + k]);
        lines.push(`${String(i).padStart(4)}  TYPEMAP  ntot=${ntot} rettype=${code[i + 2]} slots=[${slots.join(',')}]`);
        i += 3 + ntot;
        continue;
      }
      let s = String(i).padStart(4) + '  ' + (OPS[op] || `?${op}`);
      const n = oplen(op);
      if (op === 8) s += `  entry=${code[i + 1]} argc=${code[i + 2]}`;
      else if (n === 2) s += `  ${code[i + 1]} ${code[i + 2]}`;
      else if (n === 1) s += `  ${code[i + 1]}`;
      i += 1 + n;
      lines.push(s);
    }
    return { ...c, text: lines.join('\n') };
  }

  // `exports`: a compatibility surface for callers that used to poke the wasm instance directly.
  // `mem.buffer` is the JS interpreter's own memory (native/ir_interpreter.mjs), using the SAME
  // address map (CODE_BASE, heap [488000,524288)) as the retired wasm instance - populated by
  // the MOST RECENT run()/ir() call on this compiler (there is one shared interpreter instance
  // per createCompiler(), matching the old one-wasm-instance-per-compiler model). Compiler-
  // internal state that only exists inside the native compiler's OWN (separate) process -
  // SYMBOLS [150000,157000) and TOKENS [296000,...) - is NOT mirrored here; callers that need
  // those read compile()'s own `tokens`/`symbols` fields instead (seed/lumen_mcp.mjs's
  // symbolsFromSource/tokensFromSource do exactly this - see that file).
  const sharedInterp = createInterpreter();
  const exportsShim = {
    get mem() { return { buffer: sharedInterp.mem }; },
    set_fuel_max: (v) => sharedInterp.set_fuel_max(v),
    set_prof: (on) => sharedInterp.set_prof(on),
    prof_count: (entry) => sharedInterp.prof_count(entry),
    get_last_steps: () => sharedInterp.get_last_steps(),
  };

  return { compile, run, ir, assembleMs, exports: exportsShim };
}
