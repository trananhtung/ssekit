#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseSSE } from "./parse.js";
import { streamSSEText } from "./llm.js";

const HELP = `ssekit — parse a Server-Sent Events stream

Usage:
  ssekit [file]            Parse SSE and print each event as a JSON line
  ssekit --text [file]     Print only the extracted LLM text deltas

Options:
  --text, -t               Extract LLM text deltas (OpenAI/Anthropic shapes)
  --help, -h               Show this help

Reads from stdin when no file is given. Handy for inspecting a saved stream:
  cat stream.txt | ssekit
  cat openai-stream.txt | ssekit --text`;

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

async function main(argv: string[]): Promise<number> {
  const args = new Set(argv);
  if (args.has("--help") || args.has("-h")) {
    process.stdout.write(HELP + "\n");
    return 0;
  }

  const textMode = args.has("--text") || args.has("-t");
  const file = argv.find((a) => !a.startsWith("-"));
  const input = file ? readFileSync(file, "utf8") : readStdin();

  if (textMode) {
    for await (const delta of streamSSEText(input)) process.stdout.write(delta);
    process.stdout.write("\n");
  } else {
    for await (const event of parseSSE(input)) {
      process.stdout.write(JSON.stringify(event) + "\n");
    }
  }
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code));
