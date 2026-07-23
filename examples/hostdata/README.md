# Host-fed decision kernels (the codegen seam)

The pattern for putting a Lumen kernel in charge of live decisions while the
transport (network, TLS, signing) still lives on a host shim:

```
host fetch (live data)  ->  generate main() with data embedded
                        ->  kernel.lm + generated main  ->  lumen run
                        ->  token-walk parse emitted records
                        ->  host RE-COMPUTES and HALTS on any diff
```

- **The kernel is the authority; the host is the courier.** The host acts on
  the kernel's output, never on its own computation. Its only computational
  role is the cross-check: recompute every decision independently and refuse
  to proceed on any disagreement, so every live iteration is a
  two-implementation proof rather than trust.
- **The codegen seam:** programs cannot read stdin or files yet, so live data
  reaches the kernel as literal arguments in a generated `main()` appended to
  the kernel fragment. Deterministic, auditable (the generated program IS the
  input record), and cheap under the warm daemon; the cost is a recompile per
  data refresh. A stdin/file data path is tracked friction that would retire
  this seam without changing any kernel.
- **Parsing:** CLI stdout concatenates `console.print` output without
  newlines, so consumers split on record keywords and walk fixed arities
  (see `decide_kernel.lm`'s `DEC` records). Also tracked friction.
- **Toward full ownership:** the staged plan for moving transport itself into
  Lumen (JSON, SHA-256, HMAC, bignum + RSA-PSS signing, a hosted-TLS interim
  seam, TLS 1.3 with kill criteria) is
  `docs/plans/2026-07-22-signed-https-client.md`.

`decide_kernel.lm` is the runnable, self-contained demonstration: a generic
scoring/gate kernel with a demo main standing in for the host's generated one.
