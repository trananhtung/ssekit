import { createParser, type ServerSentEvent } from "./parser.js";

/**
 * Any source `parseSSE` can read:
 *  - a whole SSE payload as a `string`
 *  - a WHATWG `ReadableStream` of `Uint8Array` or `string` (e.g. `fetch().body`)
 *  - an (async) iterable of `Uint8Array` or `string` chunks
 */
export type SSESource =
  | string
  | ReadableStream<Uint8Array | string>
  | AsyncIterable<Uint8Array | string>
  | Iterable<Uint8Array | string>;

function isReadableStream(x: unknown): x is ReadableStream<Uint8Array | string> {
  return typeof (x as { getReader?: unknown })?.getReader === "function";
}

/** Normalise any {@link SSESource} into an async iterable of decoded string chunks. */
async function* toStringChunks(source: SSESource): AsyncGenerator<string> {
  if (typeof source === "string") {
    yield source;
    return;
  }

  const decoder = new TextDecoder();

  if (isReadableStream(source)) {
    const reader = source.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        yield typeof value === "string" ? value : decoder.decode(value, { stream: true });
      }
      const tail = decoder.decode();
      if (tail) yield tail;
    } finally {
      reader.releaseLock?.();
    }
    return;
  }

  const anySource = source as unknown as Record<symbol, unknown>;
  const asyncIt = anySource[Symbol.asyncIterator];
  const syncIt = anySource[Symbol.iterator];
  if (typeof asyncIt === "function" || typeof syncIt === "function") {
    for await (const chunk of source as AsyncIterable<Uint8Array | string>) {
      yield typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    }
    const tail = decoder.decode();
    if (tail) yield tail;
    return;
  }

  throw new TypeError("parseSSE: source must be a string, ReadableStream, or (async) iterable");
}

/**
 * Parse an SSE stream into an async iterable of {@link ServerSentEvent}s.
 *
 * Works with `fetch` response bodies, async generators, and plain strings.
 *
 * @example
 * ```ts
 * const res = await fetch(url, { headers: { Accept: "text/event-stream" } });
 * for await (const event of parseSSE(res.body!)) {
 *   console.log(event.event, event.data);
 * }
 * ```
 */
export async function* parseSSE(source: SSESource): AsyncGenerator<ServerSentEvent> {
  const queue: ServerSentEvent[] = [];
  const parser = createParser((e) => queue.push(e));

  for await (const text of toStringChunks(source)) {
    parser.feed(text);
    while (queue.length) yield queue.shift()!;
  }
  // Per spec, an event left incomplete at EOF (no trailing blank line) is discarded.
}
