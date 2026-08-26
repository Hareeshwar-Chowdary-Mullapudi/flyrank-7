import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const quarantinePath = join(__dirname, "..", "..", "logs", "quarantine.jsonl");

export function quarantineFailure(entry) {
  mkdirSync(dirname(quarantinePath), { recursive: true });
  const line = JSON.stringify({
    at: new Date().toISOString(),
    ...entry,
  });
  appendFileSync(quarantinePath, `${line}\n`, "utf8");
}
