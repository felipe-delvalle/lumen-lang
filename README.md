# Lumen

An AI-native programming language: authored by LLM agents, gated by executable oracles.

The compiler proves itself correct on every commit: the self-hosted compiler (written in
Lumen) reproduces the reference seed's compilation of its own source bit-for-bit, and the
native backends (C emitter, LLVM emitter - both written in Lumen) are CI-gated to
byte-identical output against the reference interpreter on a fixed conformance corpus.

This repository reserves the project's public home. The toolchain, conformance corpus,
oracle gates, and the methodology paper ("Oracle-Gated Self-Hosting: Building a Programming
Language with LLM Agent Fleets") are being prepared for extraction from the development
monorepo.
