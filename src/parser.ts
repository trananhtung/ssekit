/**
 * A spec-compliant, incremental Server-Sent Events (SSE) parser.
 *
 * Implements the WHATWG event-stream parsing rules: `event` / `data` / `id` /
 * `retry` fields, comments (`:`), multi-line `data`, all three line terminators
 * (`\n`, `\r\n`, `\r`), a leading BOM, and the rule that an event with no `data`
 * is not dispatched. The parser is push-based and handles chunk boundaries that
 * fall in the middle of a line or between `\r` and `\n`.
 */

/** A parsed Server-Sent Event. */
export interface ServerSentEvent {
  /** The event `data` (multiple `data:` lines joined with `\n`, trailing `\n` removed). */
  data: string;
  /** The `event:` type, or `undefined` for the default (`"message"`). */
  event: string | undefined;
  /** The last seen `id:` value, or `undefined`. */
  id: string | undefined;
  /** The `retry:` reconnection time in ms, if a valid integer was sent. */
  retry: number | undefined;
}

/** A push-based incremental parser. */
export interface SSEParser {
  /** Feed the next chunk of the stream (text). Dispatches any completed events. */
  feed(chunk: string): void;
  /** Reset all internal state (buffers, last id). */
  reset(): void;
}

/**
 * Create an incremental SSE parser that calls `onEvent` for every dispatched event.
 *
 * @example
 * ```ts
 * const parser = createParser((e) => console.log(e.data));
 * parser.feed("data: hello\n\n");
 * ```
 */
export function createParser(onEvent: (event: ServerSentEvent) => void): SSEParser {
  let buf = "";
  let dataBuf = "";
  let eventType = "";
  let lastId: string | undefined;
  let retry: number | undefined;
  let hasData = false;
  let started = false;
  let crAtEnd = false; // previous chunk ended on a CR — swallow a leading LF (split \r\n)

  function dispatch(): void {
    if (!hasData) {
      // Per spec: an event with an empty data buffer is not dispatched, but the
      // event-type buffer is still reset.
      eventType = "";
      return;
    }
    const data = dataBuf.endsWith("\n") ? dataBuf.slice(0, -1) : dataBuf;
    onEvent({ data, event: eventType || undefined, id: lastId, retry });
    dataBuf = "";
    eventType = "";
    hasData = false;
    retry = undefined;
  }

  function processLine(line: string): void {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.charCodeAt(0) === 0x3a /* ':' */) return; // comment

    const colon = line.indexOf(":");
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.charCodeAt(0) === 0x20 /* space */) value = value.slice(1);
    }

    switch (field) {
      case "event":
        eventType = value;
        break;
      case "data":
        dataBuf += value + "\n";
        hasData = true;
        break;
      case "id":
        if (!value.includes("\0")) lastId = value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) retry = Number(value);
        break;
      default:
        break; // ignore unknown fields
    }
  }

  return {
    feed(chunk: string): void {
      if (!chunk) return;
      buf += chunk;

      if (!started) {
        started = true;
        if (buf.charCodeAt(0) === 0xfeff) buf = buf.slice(1); // strip BOM
      }

      // A CR at the end of the previous chunk already terminated its line; if this
      // chunk starts with LF, it's the tail of a split \r\n — drop it.
      if (crAtEnd) {
        crAtEnd = false;
        if (buf.charCodeAt(0) === 0x0a) buf = buf.slice(1);
      }

      let start = 0;
      let pos = 0;
      while (pos < buf.length) {
        const code = buf.charCodeAt(pos);
        if (code === 0x0a /* \n */) {
          processLine(buf.slice(start, pos));
          pos += 1;
          start = pos;
        } else if (code === 0x0d /* \r */) {
          processLine(buf.slice(start, pos));
          if (pos === buf.length - 1) {
            // CR is the last char: terminate now, remember to swallow a leading LF next chunk.
            crAtEnd = true;
            pos += 1;
          } else {
            pos += buf.charCodeAt(pos + 1) === 0x0a ? 2 : 1;
          }
          start = pos;
        } else {
          pos += 1;
        }
      }
      buf = buf.slice(start);
    },

    reset(): void {
      buf = "";
      dataBuf = "";
      eventType = "";
      lastId = undefined;
      retry = undefined;
      hasData = false;
      started = false;
      crAtEnd = false;
    },
  };
}
