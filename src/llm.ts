import { parseSSE, type SSESource } from "./parse.js";
import type { ServerSentEvent } from "./parser.js";

/**
 * Extract the incremental text from one parsed SSE event's JSON payload.
 * Return `undefined`/`""` to skip an event (e.g. role/keepalive frames).
 */
export type TextExtractor = (json: unknown, event: ServerSentEvent) => string | undefined;

/** Options for {@link streamSSEText}. */
export interface StreamTextOptions {
  /** Custom delta extractor. Defaults to {@link defaultExtractor} (OpenAI + Anthropic). */
  extract?: TextExtractor;
  /** Sentinel `data` value that ends the stream. Default `"[DONE]"`. */
  doneSentinel?: string | null;
}

/**
 * Default extractor covering the common LLM streaming shapes:
 *  - OpenAI chat:        `choices[0].delta.content`
 *  - OpenAI completions: `choices[0].text`
 *  - Anthropic Messages: `content_block_delta` → `delta.text`
 */
export const defaultExtractor: TextExtractor = (json) => {
  const j = json as Record<string, any>;
  const choice = j?.choices?.[0];
  if (choice?.delta?.content != null) return String(choice.delta.content);
  if (typeof choice?.text === "string") return choice.text;
  if (j?.type === "content_block_delta" && typeof j?.delta?.text === "string") return j.delta.text;
  if (typeof j?.delta?.text === "string") return j.delta.text;
  return undefined;
};

/**
 * Stream just the text deltas out of an LLM SSE response.
 *
 * Parses each event, stops at the done sentinel (`[DONE]` by default), JSON-parses
 * the `data`, and yields the extracted text. Non-JSON or non-text frames are skipped.
 *
 * @example
 * ```ts
 * const res = await fetch(openaiUrl, { method: "POST", body, headers });
 * let answer = "";
 * for await (const delta of streamSSEText(res.body!)) {
 *   answer += delta;
 *   process.stdout.write(delta);
 * }
 * ```
 */
export async function* streamSSEText(
  source: SSESource,
  options: StreamTextOptions = {},
): AsyncGenerator<string> {
  const extract = options.extract ?? defaultExtractor;
  const done = options.doneSentinel === undefined ? "[DONE]" : options.doneSentinel;

  for await (const event of parseSSE(source)) {
    if (done !== null && event.data === done) return;
    let json: unknown;
    try {
      json = JSON.parse(event.data);
    } catch {
      continue; // not JSON (comment/keepalive) — skip
    }
    const text = extract(json, event);
    if (text) yield text;
  }
}
