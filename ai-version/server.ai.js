/**
 * Quarantined AI-rematch sketch (NOT the submission).
 * Illustrates common AI shortcuts vs the hand-built ../src implementation.
 *
 * Deliberate differences to review:
 * - 10-minute-ish default timeout left wide / SDK retries left on
 * - May return raw model text on soft failure
 * - Prompt embedded as a string instead of a versioned file
 */
import express from "express";
import OpenAI from "openai";
import { z } from "zod";

const app = express();
app.use(express.json());

const Output = z.object({
  category: z.enum(["billing", "bug", "feature", "other"]),
  urgency: z.enum(["low", "normal", "high"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

// AI often inlines the prompt and forgets a versioned file.
const SYSTEM = `Classify support messages as JSON with category, urgency, confidence, reason.`;

// AI often leaves SDK defaults: long timeout + automatic retries.
const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
  // timeout omitted on purpose (SDK default ~10 minutes)
  // maxRetries omitted on purpose (SDK default 2)
});

app.post("/triage", async (req, res) => {
  const text = req.body?.text;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "bad input" }); // often forgets field name
  }

  try {
    const completion = await client.chat.completions.create({
      model: process.env.LLM_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        // AI sometimes concatenates user text into the system prompt — avoided here,
        // but also often skips JSON-encoding.
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(raw);
      const out = Output.parse(parsed);
      return res.json(out);
    } catch {
      // Common AI mistake: return raw model text when parse fails.
      return res.status(200).json({ raw });
    }
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

app.listen(process.env.PORT || 3010, () => {
  console.log("ai-version listening (quarantine only)");
});
