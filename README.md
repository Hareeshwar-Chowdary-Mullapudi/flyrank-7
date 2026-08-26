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
│       ├── complete.js   # model call
│       └── schema.js
└── package.json
```

> Note: `A-7/` is a separate React experiment — this assignment API lives at the `A7/` root.
