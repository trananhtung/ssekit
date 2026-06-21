# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-21

### Added

- `createParser` — incremental, spec-compliant SSE parser (comments, multi-line
  `data`, `\n`/`\r\n`/`\r`, BOM, no-data-no-dispatch, chunk-boundary reassembly).
- `parseSSE` — async-iterable parser over a string, `ReadableStream`, or (async)
  iterable, with streaming UTF-8 decoding.
- `streamSSEText` — yield LLM text deltas (OpenAI + Anthropic shapes), stop at
  `[DONE]`, with a pluggable `extract` function.
- `ssekit` CLI to inspect a saved stream (`--text` for deltas only).
- ESM + CJS builds, types, and CI across Node 18 / 20 / 22.
