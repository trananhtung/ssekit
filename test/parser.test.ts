import { describe, expect, it } from "vitest";
import { createParser, type ServerSentEvent } from "../src/parser.js";

function collect(chunks: string[]): ServerSentEvent[] {
  const out: ServerSentEvent[] = [];
  const p = createParser((e) => out.push(e));
  for (const c of chunks) p.feed(c);
  return out;
}

describe("createParser — basics", () => {
  it("parses a simple event", () => {
    const [e] = collect(["data: hello\n\n"]);
    expect(e?.data).toBe("hello");
    expect(e?.event).toBeUndefined();
  });

  it("removes exactly one leading space after the colon", () => {
    expect(collect(["data:  two-spaces\n\n"])[0]?.data).toBe(" two-spaces");
  });

  it("handles a value with no space after colon", () => {
    expect(collect(["data:nospace\n\n"])[0]?.data).toBe("nospace");
  });

  it("joins multi-line data with newlines", () => {
    expect(collect(["data: a\ndata: b\ndata: c\n\n"])[0]?.data).toBe("a\nb\nc");
  });

  it("captures event, id, and retry", () => {
    const [e] = collect(["event: ping\nid: 42\nretry: 3000\ndata: x\n\n"]);
    expect(e).toMatchObject({ event: "ping", id: "42", retry: 3000, data: "x" });
  });

  it("ignores comment lines", () => {
    const out = collect([": this is a comment\ndata: real\n\n"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.data).toBe("real");
  });

  it("does NOT dispatch an event with no data (spec)", () => {
    expect(collect(["event: ping\n\n"])).toHaveLength(0);
  });

  it("ignores a non-integer retry", () => {
    expect(collect(["retry: soon\ndata: x\n\n"])[0]?.retry).toBeUndefined();
  });

  it("treats a field with no colon as a field with empty value", () => {
    // a lone "data" line appends an empty string + newline
    expect(collect(["data\n\n"])[0]?.data).toBe("");
  });
});

describe("createParser — line terminators", () => {
  it("handles CRLF", () => {
    expect(collect(["data: x\r\n\r\n"])[0]?.data).toBe("x");
  });

  it("handles lone CR", () => {
    expect(collect(["data: x\r\r"])[0]?.data).toBe("x");
  });

  it("handles a CRLF split across two chunks", () => {
    const out = collect(["data: x\r", "\n\r\n"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.data).toBe("x");
  });

  it("strips a leading BOM", () => {
    expect(collect(["﻿data: x\n\n"])[0]?.data).toBe("x");
  });
});

describe("createParser — chunk boundaries", () => {
  it("reassembles an event split mid-line across many chunks", () => {
    const out = collect(["da", "ta: hel", "lo wor", "ld\n", "\n"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.data).toBe("hello world");
  });

  it("emits multiple events from one chunk", () => {
    const out = collect(["data: one\n\ndata: two\n\n"]);
    expect(out.map((e) => e.data)).toEqual(["one", "two"]);
  });

  it("persists the last id across events", () => {
    const out = collect(["id: 1\ndata: a\n\ndata: b\n\n"]);
    expect(out[0]?.id).toBe("1");
    expect(out[1]?.id).toBe("1"); // id sticks until changed
  });

  it("discards an incomplete trailing event at EOF (no blank line)", () => {
    expect(collect(["data: complete\n\ndata: partial\n"]).map((e) => e.data)).toEqual([
      "complete",
    ]);
  });
});
