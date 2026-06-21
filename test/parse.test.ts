import { describe, expect, it } from "vitest";
import { parseSSE } from "../src/parse.js";

async function collect(source: Parameters<typeof parseSSE>[0]) {
  const out = [];
  for await (const e of parseSSE(source)) out.push(e);
  return out;
}

function streamFrom(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array | string> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]!);
      else controller.close();
    },
  });
}

describe("parseSSE", () => {
  it("parses from a string", async () => {
    const out = await collect("data: a\n\ndata: b\n\n");
    expect(out.map((e) => e.data)).toEqual(["a", "b"]);
  });

  it("parses from an async generator of strings", async () => {
    async function* gen() {
      yield "data: ";
      yield "hello\n";
      yield "\n";
    }
    const out = await collect(gen());
    expect(out[0]?.data).toBe("hello");
  });

  it("parses from a ReadableStream of Uint8Array", async () => {
    const enc = new TextEncoder();
    const stream = streamFrom([enc.encode("data: chu"), enc.encode("nked\n\n")]);
    const out = await collect(stream);
    expect(out[0]?.data).toBe("chunked");
  });

  it("decodes a multi-byte character split across two byte chunks", async () => {
    const full = enc("data: é\n\n"); // é is 2 bytes in UTF-8
    const split = Math.floor(full.length / 2);
    const stream = streamFrom([full.slice(0, split), full.slice(split)]);
    const out = await collect(stream);
    expect(out[0]?.data).toBe("é");
  });

  it("throws on an unsupported source", async () => {
    await expect(collect(123 as never)).rejects.toThrow(/string, ReadableStream/);
  });
});

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
