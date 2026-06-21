# @billdaddy/ssekit

> Spec-compliant **Server-Sent Events** parser with first-class **LLM streaming** helpers. **Zero dependencies**, web-standard.

[![CI](https://github.com/trananhtung/ssekit/actions/workflows/ci.yml/badge.svg)](https://github.com/trananhtung/ssekit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ssekit.svg)](https://www.npmjs.com/package/ssekit)
[![bundle size](https://img.shields.io/bundlephobia/minzip/ssekit)](https://bundlephobia.com/package/ssekit)
[![types](https://img.shields.io/npm/types/ssekit.svg)](https://www.npmjs.com/package/ssekit)
[![license](https://img.shields.io/npm/l/ssekit.svg)](./LICENSE)

Streaming an LLM response means parsing Server-Sent Events — and SSE has more
edge cases than it looks: multi-line `data`, comments, three different line
terminators, a BOM, and frames that split across network chunks (even in the
middle of a UTF-8 character or between `\r` and `\n`). `@billdaddy/ssekit` handles all of it,
works directly with a `fetch` response body, and gives you the text deltas in one
line.

```ts
import { streamSSEText } from "@billdaddy/ssekit";

const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "gpt-4o", stream: true, messages }),
});

for await (const delta of streamSSEText(res.body!)) {
  process.stdout.write(delta); // prints the answer as it arrives
}
```

## Why @billdaddy/ssekit?

- **Correct.** Implements the WHATWG event-stream parsing algorithm — comments,
  multi-line `data`, `\n` / `\r\n` / `\r`, leading BOM, and "no `data` ⇒ no
  dispatch". Reassembles events split across arbitrary chunk boundaries.
- **Web-standard & universal.** Reads a `ReadableStream` (browser/Node `fetch`),
  an async generator, or a plain string. Decodes bytes with `TextDecoder`,
  handling multi-byte characters split across chunks.
- **LLM-aware.** `streamSSEText` yields just the text deltas for OpenAI and
  Anthropic shapes out of the box, stops at `[DONE]`, and takes a custom extractor
  for anything else.
- **Zero dependencies**, ESM + CJS + types, and a CLI for inspecting streams.

## Install

```bash
npm install @billdaddy/ssekit
# or: pnpm add @billdaddy/ssekit  /  yarn add @billdaddy/ssekit  /  bun add @billdaddy/ssekit
```

## API

### `streamSSEText(source, options?) → AsyncGenerator<string>`

Yield the incremental text from an LLM SSE stream.

```ts
for await (const delta of streamSSEText(res.body!)) answer += delta;
```

| Option         | Type                              | Default     | Description                                  |
| -------------- | --------------------------------- | ----------- | -------------------------------------------- |
| `extract`      | `(json, event) => string \| void` | OpenAI+Claude | Pull the delta out of each frame's JSON.   |
| `doneSentinel` | `string \| null`                  | `"[DONE]"`  | `data` value that ends the stream (`null` = none). |

Custom extractor:

```ts
for await (const t of streamSSEText(body, { extract: (j) => j.token })) { … }
```

### `parseSSE(source) → AsyncGenerator<ServerSentEvent>`

The full event stream — `data`, `event`, `id`, `retry`.

```ts
for await (const e of parseSSE(res.body!)) {
  console.log(e.event ?? "message", e.id, e.data);
}
```

`source` may be a `string`, a `ReadableStream<Uint8Array | string>`, or an
(async) iterable of `Uint8Array | string`.

### `createParser(onEvent) → SSEParser`

The low-level push parser, if you manage the bytes yourself.

```ts
const parser = createParser((e) => handle(e));
socket.on("data", (chunk) => parser.feed(chunk.toString("utf8")));
```

```ts
interface ServerSentEvent {
  data: string;
  event: string | undefined;
  id: string | undefined;
  retry: number | undefined;
}
```

## CLI

```bash
cat stream.txt | ssekit            # one JSON object per event
cat openai-stream.txt | ssekit -t  # just the concatenated text deltas
```

## Companion packages

`@billdaddy/ssekit` pairs with the rest of the LLM toolkit:
[`tokenfit`](https://www.npmjs.com/package/tokenfit) (token budgeting),
[`scrubtext`](https://www.npmjs.com/package/scrubtext) (redact PII before sending),
and [`jsonpluck`](https://www.npmjs.com/package/jsonpluck) (parse JSON out of model output).

## License

[MIT](./LICENSE) © Tung Tran
