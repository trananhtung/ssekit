import { describe, expect, it } from "vitest";
import { streamSSEText, defaultExtractor } from "../src/llm.js";

async function collect(gen: AsyncGenerator<string>) {
  let out = "";
  for await (const d of gen) out += d;
  return out;
}

describe("defaultExtractor", () => {
  it("reads OpenAI chat deltas", () => {
    expect(defaultExtractor({ choices: [{ delta: { content: "Hi" } }] }, {} as never)).toBe("Hi");
  });
  it("reads OpenAI completion text", () => {
    expect(defaultExtractor({ choices: [{ text: "yo" }] }, {} as never)).toBe("yo");
  });
  it("reads Anthropic content_block_delta", () => {
    expect(
      defaultExtractor({ type: "content_block_delta", delta: { text: "A" } }, {} as never),
    ).toBe("A");
  });
  it("returns undefined for non-text frames", () => {
    expect(defaultExtractor({ choices: [{ delta: { role: "assistant" } }] }, {} as never)).toBeUndefined();
  });
});

describe("streamSSEText", () => {
  it("assembles an OpenAI-style stream", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":", world"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");
    expect(await collect(streamSSEText(sse))).toBe("Hello, world");
  });

  it("assembles an Anthropic-style stream", async () => {
    const sse = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"Hel"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"lo"}}\n\n',
    ].join("");
    expect(await collect(streamSSEText(sse))).toBe("Hello");
  });

  it("stops at the done sentinel and ignores anything after", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\ndata: [DONE]\n\ndata: {"choices":[{"delta":{"content":"B"}}]}\n\n';
    expect(await collect(streamSSEText(sse))).toBe("A");
  });

  it("skips non-JSON frames", async () => {
    const sse = ": keepalive\n\ndata: not json\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n";
    expect(await collect(streamSSEText(sse))).toBe("ok");
  });

  it("honours a custom extractor", async () => {
    const sse = 'data: {"token":"x"}\n\ndata: {"token":"y"}\n\n';
    const out = await collect(
      streamSSEText(sse, { extract: (j) => (j as { token?: string }).token }),
    );
    expect(out).toBe("xy");
  });

  it("can disable the done sentinel", async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"keep"}}]}\n\ndata: [DONE]\n\n';
    // with sentinel disabled, [DONE] is just non-JSON and skipped, content still read
    expect(await collect(streamSSEText(sse, { doneSentinel: null }))).toBe("keep");
  });
});
