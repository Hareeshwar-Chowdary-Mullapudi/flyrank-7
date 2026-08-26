import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const casesPath = join(__dirname, "cases.json");
const cases = JSON.parse(readFileSync(casesPath, "utf8"));

const BASE_URL = (process.env.EVAL_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

async function triage(text) {
  const res = await fetch(`${BASE_URL}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function matchCategory(got, expected) {
  return got?.category === expected.category;
}

const results = [];
let matched = 0;

console.log(`Eval against ${BASE_URL}/triage  (${cases.length} cases)\n`);

for (const c of cases) {
  const { status, body } = await triage(c.text);
  const ok = status === 200 && matchCategory(body, c.expected);
  if (ok) matched += 1;

  results.push({
    id: c.id,
    ok,
    status,
    expected: c.expected.category,
    got: body?.category ?? null,
    urgency_got: body?.urgency ?? null,
    error: body?.error ?? null,
  });

  const mark = ok ? "PASS" : "FAIL";
  console.log(
    `${mark}  ${c.id.padEnd(22)} expected=${c.expected.category.padEnd(8)} got=${String(body?.category ?? body?.error ?? status)}`
  );
}

const failed = results.filter((r) => !r.ok);
const pct = ((matched / cases.length) * 100).toFixed(0);

console.log(
  `\nScore: ${matched}/${cases.length} on key field "category" (${pct}%)`
);
console.log(`Prompt: triage-v1  Date: ${new Date().toISOString().slice(0, 10)}`);

if (failed.length) {
  console.log("\nFailed cases:");
  for (const f of failed) {
    console.log(`  - ${f.id}: expected ${f.expected}, got ${f.got ?? f.error}`);
  }
}

process.exitCode = failed.length ? 1 : 0;
