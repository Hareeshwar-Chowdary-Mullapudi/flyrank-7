/**
 * Strip markdown fences / leading chatter and parse a JSON object from model text.
 * Returns { ok: true, value } or { ok: false, error }.
 */
export function parseModelJson(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Empty model response" };
  }

  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    text = fence[1].trim();
  }

  // If there's leading prose, take the first {...} block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: "No JSON object found in model response" };
  }

  text = text.slice(start, end + 1);

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: `JSON.parse failed: ${err.message}` };
  }
}
