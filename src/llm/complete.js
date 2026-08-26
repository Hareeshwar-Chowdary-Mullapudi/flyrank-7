import { createLlmClient } from "./client.js";
import { getPromptVersion, loadSystemPrompt } from "./prompt.js";
import { parseModelJson } from "./parse.js";
import { quarantineFailure } from "./quarantine.js";
import { triageOutputSchema } from "./schema.js";

let client;

function getClient() {
  if (!client) client = createLlmClient();
  return client;
}

async function callModel(messages) {
  const openai = getClient();
  const started = Date.now();
  const res = await openai.chat.completions.create({
    model: process.env.LLM_MODEL,
    temperature: 0.2,
    messages,
  });

  return {
    raw: res.choices[0]?.message?.content ?? "",
    prompt_version: getPromptVersion(),
    model: process.env.LLM_MODEL,
    duration_ms: Date.now() - started,
    usage: res.usage ?? null,
  };
}

function validateOutput(value) {
  const result = triageOutputSchema.safeParse(value);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issue = result.error.issues[0];
  const path = issue?.path?.join(".") || "(root)";
  return {
    ok: false,
    error: `${path}: ${issue?.message ?? "schema validation failed"}`,
  };
}

function tryParseAndValidate(raw) {
  const parsed = parseModelJson(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, raw };
  }
  const validated = validateOutput(parsed.value);
  if (!validated.ok) {
    return { ok: false, error: validated.error, raw, parsed: parsed.value };
  }
  return { ok: true, data: validated.data, raw };
}

/**
 * First call + optional one repair retry. Never returns raw model text to the caller.
 */
export async function runTriage(text) {
  const system = loadSystemPrompt();
  const userContent = JSON.stringify({ text });

  const first = await callModel([
    { role: "system", content: system },
    { role: "user", content: userContent },
  ]);

  let attempt = tryParseAndValidate(first.raw);
  let repairs = 0;

  if (!attempt.ok) {
    repairs = 1;
    const repair = await callModel([
      { role: "system", content: system },
      { role: "user", content: userContent },
      {
        role: "assistant",
        content: first.raw,
      },
      {
        role: "user",
        content: [
          "Your previous answer was rejected for this reason:",
          attempt.error,
          "Return only corrected JSON matching the schema. No markdown, no commentary.",
        ].join("\n"),
      },
    ]);

    attempt = tryParseAndValidate(repair.raw);

    if (!attempt.ok) {
      quarantineFailure({
        input: { text },
        prompt_version: first.prompt_version,
        model: first.model,
        error: attempt.error,
        raw_first: first.raw,
        raw_repair: repair.raw,
      });

      const err = new Error(
        `Model output failed validation after repair: ${attempt.error}`
      );
      err.status = 422;
      err.meta = {
        prompt_version: first.prompt_version,
        repairs,
      };
      throw err;
    }

    return {
      data: attempt.data,
      prompt_version: first.prompt_version,
      model: first.model,
      repairs,
    };
  }

  return {
    data: attempt.data,
    prompt_version: first.prompt_version,
    model: first.model,
    repairs,
  };
}

/** @deprecated use runTriage — kept for Stage 2 experiments */
export async function completeTriage(text) {
  const system = loadSystemPrompt();
  const result = await callModel([
    { role: "system", content: system },
    { role: "user", content: JSON.stringify({ text }) },
  ]);
  return {
    answer: result.raw,
    prompt_version: result.prompt_version,
    model: result.model,
    duration_ms: result.duration_ms,
    usage: result.usage,
  };
}
