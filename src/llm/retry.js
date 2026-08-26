/** Sleep ms */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decide whether an OpenAI SDK / fetch error is worth retrying.
 * Yes: timeouts, 429, 5xx. Never: 400, 401, 403.
 */
export function isRetryableError(err) {
  const status = err?.status ?? err?.response?.status ?? err?.statusCode;

  if (status === 401 || status === 403 || status === 400) {
    return false;
  }

  if (status === 429 || (typeof status === "number" && status >= 500)) {
    return true;
  }

  const name = err?.name ?? "";
  const msg = String(err?.message ?? "").toLowerCase();

  if (
    name === "APIConnectionTimeoutError" ||
    name === "TimeoutError" ||
    msg.includes("timeout") ||
    msg.includes("timed out")
  ) {
    return true;
  }

  if (name === "APIConnectionError" || msg.includes("network")) {
    return true;
  }

  return false;
}

export function isTimeoutError(err) {
  const name = err?.name ?? "";
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    name === "APIConnectionTimeoutError" ||
    name === "TimeoutError" ||
    msg.includes("timeout") ||
    msg.includes("timed out")
  );
}

/**
 * Backoff: 1s, 2s, 4s + jitter. Prefer Retry-After when present (seconds).
 */
export function backoffMs(attempt, err) {
  const header =
    err?.headers?.["retry-after"] ??
    err?.response?.headers?.["retry-after"] ??
    err?.headers?.get?.("retry-after");

  if (header != null && header !== "") {
    const asNum = Number(header);
    if (!Number.isNaN(asNum)) {
      return Math.max(0, asNum * 1000);
    }
    const when = Date.parse(header);
    if (!Number.isNaN(when)) {
      return Math.max(0, when - Date.now());
    }
  }

  const base = 1000 * 2 ** attempt; // 1s, 2s, 4s
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}
