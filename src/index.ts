/**
 * ssekit — a spec-compliant Server-Sent Events parser with first-class LLM
 * streaming helpers. Zero dependencies, web-standard.
 *
 * @packageDocumentation
 */

export { createParser, type ServerSentEvent, type SSEParser } from "./parser.js";
export { parseSSE, type SSESource } from "./parse.js";
export {
  streamSSEText,
  defaultExtractor,
  type TextExtractor,
  type StreamTextOptions,
} from "./llm.js";
