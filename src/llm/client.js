import OpenAI from "openai";

export function createLlmClient() {
  const baseURL = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error(
      "Missing LLM_BASE_URL or LLM_API_KEY. Copy .env.example to .env and set your provider values."
    );
  }

  return new OpenAI({
    baseURL,
    apiKey,
    timeout: 30_000,
    maxRetries: 0,
  });
}
