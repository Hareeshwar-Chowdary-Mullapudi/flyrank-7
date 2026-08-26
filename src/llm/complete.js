import { createLlmClient } from "./client.js";
import { getPromptVersion, loadSystemPrompt } from "./prompt.js";

let client;

function getClient() {
  if (!client) client = createLlmClient();
  return client;
}

/**
 * Call the model with the versioned system prompt + JSON-encoded user text.
 * Stage 2 returns the raw model string; Stage 3 will parse/validate.
 */
export async function completeTriage(text) {
  const openai = getClient();
  const system = loadSystemPrompt();
  // Keep untrusted content in the user role and JSON-encode it (prompt-injection hygiene).
  const userContent = JSON.stringify({ text });

  const started = Date.now();
  const res = await openai.chat.completions.create({
    model: process.env.LLM_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  });

  const answer = res.choices[0]?.message?.content ?? "";
  return {
    answer,
    prompt_version: getPromptVersion(),
    model: process.env.LLM_MODEL,
    duration_ms: Date.now() - started,
    usage: res.usage ?? null,
  };
}
