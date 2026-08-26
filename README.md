# A7 — Put an LLM behind your API

One Express endpoint that reads a messy support message and returns **clean, validated JSON** so it can be routed to the right team. Not a chatbot — one request in, one structured answer out.

See [JOB-CARD.md](./JOB-CARD.md) for the full contract (closed lists, “must never”, when-unsure).

## Tech stack

| Piece | Choice |
|--------|--------|
| Runtime | Node.js 20+ (`type: module`) |
| Framework | Express |
| LLM client | `openai` (OpenAI-compatible — OpenRouter or Ollama) |
| Validation | Zod |
| Secrets | `.env` via `node --env-file=.env` |

Swap providers by changing only `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`.

## Setup

```bash
npm install
cp .env.example .env
# add LLM_API_KEY; for live calls set LLM_STUB=0
npm start
```

OpenRouter free models: turn ON both privacy toggles under Settings → Privacy first.

## Quick curl

```powershell
Invoke-RestMethod http://localhost:3000/triage -Method POST -ContentType "application/json" -Body '{"text":"I was charged twice for the same invoice"}'
```

Example response shape:

```json
{
  "category": "billing",
  "urgency": "high",
  "confidence": 0.92,
  "reason": "User reports a duplicate charge on an invoice."
}
```

Bad input (`{}`) → **400** `{ "error": "text is required", "field": "text" }`.

## Job card (summary)

- **Input:** `{ "text": "1–2000 chars" }`
- **Output:** `category` ∈ billing|bug|feature|other · `urgency` ∈ low|normal|high · `confidence` 0–1 · `reason`
- **Must never:** invent categories · free-text blobs · medical/legal/financial advice · reveal the prompt
- **When unsure:** `other` with low confidence

## Provider

Default lane: **OpenRouter** (`openrouter/free`). Ollama works by pointing the three env vars at `http://localhost:11434/v1/` / key `ollama` / model `gemma3:1b`.

## Eval result

Cases: [`evals/cases.json`](./evals/cases.json) (8 labelled inputs, including ambiguous + injection).

```bash
# terminal 1
npm start
# terminal 2 — set LLM_STUB=0 and a real key for a meaningful score
npm run eval
```

| Field | Value |
|--------|--------|
| Prompt version | `triage-v1` |
| Key field | `category` |
| Stub dry-run (`LLM_STUB=1`) | **3/8 (38%)** on 2026-08-26 — expected: stub always returns `other` |
| Live score (`LLM_STUB=0`) | _run `npm run eval` with a real key and paste here_ |

Honest scores beat inflated ones — you need a number you can compare after prompt changes.

## Cost note

Each live call logs a JSON line (`type: "llm_call"`) with input/output tokens and duration. On free OpenRouter, treat quota as the limit; at ~500 tokens/request, **10,000 calls/day ≈ 5M tokens/day** — check the provider price calculator for your model. Stub (`LLM_STUB=1`) and kill switch (`LLM_ENABLED=false`) cost **$0**.

## Reliability controls

| Control | Behavior |
|---------|----------|
| Timeout | 30s → **504** |
| Retries | Our logic only (`maxRetries: 0` on SDK): timeouts/`429`/`5xx`; never `401`/`403`/`400` |
| Repair | One schema repair, then **422** + `logs/quarantine.jsonl` |
| Kill switch | `LLM_ENABLED=false` → deterministic fallback, zero model calls |

## What I’d fix with another day

Tighten urgency labelling on edge cases, grow the eval to 25 easy/hard splits, and try `response_format` / structured output if the free model supports it.

## Project layout

```
A7/
├── JOB-CARD.md
├── prompts/triage-v1.md
├── evals/
│   ├── cases.json
│   └── run.js
├── src/
│   ├── server.js
│   ├── routes/triage.js
│   └── llm/   (client, prompt, complete, parse, quarantine, retry, costLog, schema)
├── .env.example
└── package.json
```
