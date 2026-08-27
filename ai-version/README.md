# AI rematch — quarantined regenerate

This folder is the **AI rematch** output (Bonus stage). It is not the submission.
Hand-built code stays in `../src/`.

## Prompt used (written from memory)

```
Build a Node.js Express API (ESM) with one endpoint POST /triage.

Input JSON: { "text": string, 1-2000 chars }. Invalid input → 400 naming the field.

Output JSON only (never raw model text):
{ "category": "billing"|"bug"|"feature"|"other",
  "urgency": "low"|"normal"|"high",
  "confidence": 0-1,
  "reason": string }

Use the openai npm package pointed at env LLM_BASE_URL / LLM_API_KEY / LLM_MODEL.
Validate output with Zod. Prompt must live in prompts/triage-v1.md (system role);
user content as a separate user message, JSON-encoded.

On bad model JSON: repair once with the validation error, then 422 and append
logs/quarantine.jsonl. Timeout 30s. SDK maxRetries 0. Retry only timeouts/429/5xx
with exponential backoff+jitter; never retry 401/403/400. Log one JSON cost line
per call. LLM_STUB=1 returns hard-coded schema JSON. LLM_ENABLED=false returns
kill-switch fallback with zero model calls. Timeout → 504.
```

## What was generated here

A single-file alternate (`server.ai.js`) that an AI might produce from that prompt —
kept separate so we can diff behaviour and habits, not replace our code.
