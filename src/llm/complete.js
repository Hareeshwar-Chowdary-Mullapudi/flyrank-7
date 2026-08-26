import { createLlmClient } from "./client.js";
import { logLlmCall } from "./costLog.js";
import { getPromptVersion, loadSystemPrompt } from "./prompt.js";
import { parseModelJson } from "./parse.js";
import { quarantineFailure } from "./quarantine.js";
import {
  backoffMs,
  isRetryableError,
  isTimeoutError,
  sleep,
} from "./retry.js";
import { triageOutputSchema } from "./schema.js";

/** SDK retries are off (maxRetries: 0). We retry ourselves — max 2 extra attempts. */
const MAX_TRANSPORT_RETRIES = 2;

let client;

function getClient() {
  if (!client) client = createLlmClient();
  return client;
}

async function callModelOnce(messages) {
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

/**
 * Transport-level call with explicit retry policy.
 * Retries timeouts / 429 / 5xx with backoff+jitter. Never retries 400/401/403.
 */
async function callModel(messages, { repairs = 0 } = {}) {
  let lastErr;

  for (let attempt = 0; attempt <= MAX_TRANSPORT_RETRIES; attempt += 1) {
    try {
      const result = await callModelOnce(messages);
      logLlmCall({
        prompt_version: result.prompt_version,
        model: result.model,
        input_tokens: result.usage?.prompt_tokens,
        output_tokens: result.usage?.completion_tokens,
        duration_ms: result.duration_ms,
        repairs,
        attempt,
        ok: true,
      });
      return result;
    } catch (err) {
      lastErr = err;

      if (!isRetryableError(err) || attempt === MAX_TRANSPORT_RETRIES) {
        logLlmCall({
          prompt_version: getPromptVersion(),
          model: process.env.LLM_MODEL,
          input_tokens: null,
          output_tokens: null,
          duration_ms: null,
          repairs,
          attempt,
          ok: false,
        });

        if (isTimeoutError(err)) {
          const timeoutErr = new Error(
            "Model call timed out after 30s — try again or shorten the input"
          );
          timeoutErr.status = 504;
          throw timeoutErr;
        }

        throw err;
      }

      const wait = backoffMs(attempt, err);
      console.warn(
        JSON.stringify({
          type: "llm_retry",
          attempt,
          wait_ms: wait,
          status: err?.status ?? null,
          message: err?.message ?? String(err),
        })
      );
      await sleep(wait);
    }
  }

  throw lastErr;
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

  const first = await callModel(
    [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    { repairs: 0 }
  );

  let attempt = tryParseAndValidate(first.raw);
  let repairs = 0;

  if (!attempt.ok) {
    repairs = 1;
    const repair = await callModel(
      [
        { role: "system", content: system },
        { role: "user", content: userContent },
        { role: "assistant", content: first.raw },
        {
          role: "user",
          content: [
            "Your previous answer was rejected for this reason:",
            attempt.error,
            "Return only corrected JSON matching the schema. No markdown, no commentary.",
          ].join("\n"),
        },
      ],
      { repairs: 1 }
    );

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
