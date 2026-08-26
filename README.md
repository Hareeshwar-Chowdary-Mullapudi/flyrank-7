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

## Project layout

```
A7/
├── JOB-CARD.md
├── .env.example
├── src/
│   ├── server.js
│   ├── routes/triage.js
│   └── llm/
│       ├── hello.js      # Stage 0 smoke test
│       ├── client.js
│       └── schema.js     # Zod input + output
└── package.json
```

> Note: `A-7/` is a separate React experiment — this assignment API lives at the `A7/` root.
