import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_VERSION = "triage-v1";
const promptPath = join(__dirname, "..", "..", "prompts", `${PROMPT_VERSION}.md`);

let cached;

export function getPromptVersion() {
  return PROMPT_VERSION;
}

export function loadSystemPrompt() {
  if (!cached) {
    cached = readFileSync(promptPath, "utf8");
  }
  return cached;
}
