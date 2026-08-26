/**
 * One structured cost/observability line per model call (stdout).
 * Twelve-factor: let the environment route logs.
 */
export function logLlmCall({
  prompt_version,
  model,
  input_tokens,
  output_tokens,
  duration_ms,
  repairs,
  attempt,
  ok,
}) {
  const line = {
    type: "llm_call",
    prompt_version,
    model,
    input_tokens: input_tokens ?? null,
    output_tokens: output_tokens ?? null,
    duration_ms,
    repairs: repairs ?? 0,
    attempt: attempt ?? 0,
    ok: Boolean(ok),
    at: new Date().toISOString(),
  };
  console.log(JSON.stringify(line));
}
