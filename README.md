# A7 — Put an LLM behind your API

Express endpoint that triages a support message into validated JSON (`category`, `urgency`, `confidence`, `reason`). Same stack as earlier weeks: **Node.js · Express · ESM**.

See [JOB-CARD.md](./JOB-CARD.md) for the contract.

## Tech stack

| Piece | Choice |
|--------|--------|
| Runtime | Node.js 20+ (`type: module`) |
| Framework | Express |
| LLM client | `openai` (OpenAI-compatible — OpenRouter or Ollama) |
| Validation | Zod |
| Secrets | `.env` via `node --env-file=.env` |

Three env vars swap providers: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.

## Setup

```bash
npm install
cp .env.example .env
```

Fill `LLM_API_KEY` when you leave stub mode. For OpenRouter free models, turn ON both privacy toggles under Settings → Privacy first.

```bash
npm start
```

## Stage 0 — prove the model answers

With a real key (and `LLM_STUB` not needed for this script):

```bash
npm run hello
```

Should print something containing `ready`.

## Stage 1 — endpoint + stub (no model spend)

```bash
# Valid — 200 schema JSON
curl -i -X POST http://localhost:3000/triage ^
  -H "Content-Type: application/json" ^
  -d "{\"text\":\"My card was charged twice last night\"}"

# Broken — 400 naming the field
curl -i -X POST http://localhost:3000/triage ^
  -H "Content-Type: application/json" ^
  -d "{}"
```

With `LLM_STUB=1` the server returns a hard-coded schema-valid object and makes **zero** model calls.

## Stage 2 — prompt file + live model

Prompt lives in [`prompts/triage-v1.md`](./prompts/triage-v1.md) (role, shape, rules, when-unsure, examples). User text is sent as a **user** message (JSON-encoded), never glued into the system prompt.

1. Put your key in `.env`
2. Set `LLM_STUB=0` (or remove it)
3. Restart: `npm start`

```powershell
Invoke-RestMethod http://localhost:3000/triage -Method POST -ContentType "application/json" -Body '{"text":"I was charged twice for the same invoice"}'
```

Stage 2 returns `{ answer, prompt_version, model }` — raw model text. Stage 3 will parse + validate against Zod.

**Provider swap:** only `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` change between OpenRouter and Ollama — the rest of the code stays the same.

## Stage 3 — parse, validate, repair, quarantine

Live responses are never raw model text. Flow:

1. Parse JSON (strip \`\`\` fences / leading prose)
2. Validate with Zod (`category` / `urgency` enums, `confidence` 0–1)
3. On failure → **one** repair call with the validation error
4. Still bad → **422** + append line to `logs/quarantine.jsonl`

Happy path returns only schema-shaped JSON:

```json
{
  "category": "billing",
  "urgency": "high",
  "confidence": 0.92,
  "reason": "User reports a duplicate charge on an invoice."
}
```

## Stage 4 — production hardening

| Control | Setting |
|---------|---------|
| Timeout | Client `timeout: 30000` → HTTP **504** on slow model |
| SDK retries | **Off** (`maxRetries: 0`) — we retry ourselves |
| Our retries | Timeouts / `429` / `5xx` only, backoff 1s→2s→4s + jitter; never `400`/`401`/`403` |
| Cost log | One JSON line per call on stdout (`type: "llm_call"`, tokens, duration, repairs) |
| Kill switch | `LLM_ENABLED=false` → immediate schema fallback, **zero** model calls |

```powershell
# Kill switch check
$env:LLM_ENABLED="false"; npm start
# POST /triage → fallback JSON, no llm_call logs
```

## Project layout

```
A7/
├── JOB-CARD.md
├── prompts/
│   └── triage-v1.md      # versioned system prompt
├── .env.example
├── src/
│   ├── server.js
│   ├── routes/triage.js
│   └── llm/
│       ├── hello.js
│       ├── client.js
│       ├── prompt.js     # loads prompts/triage-v1.md
│       ├── complete.js   # model call + repair loop
│       ├── parse.js      # strip fences / JSON.parse
│       ├── quarantine.js # logs/quarantine.jsonl
│       └── schema.js
└── package.json
```

> Note: `A-7/` is a separate React experiment — this assignment API lives at the `A7/` root.
