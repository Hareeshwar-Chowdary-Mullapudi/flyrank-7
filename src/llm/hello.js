import { createLlmClient } from "./client.js";

const client = createLlmClient();

const res = await client.chat.completions.create({
  model: process.env.LLM_MODEL,
  messages: [{ role: "user", content: "Reply with exactly the word: ready" }],
});

console.log(res.choices[0].message.content);
