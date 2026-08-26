import { z } from "zod";

export const triageInputSchema = z.object({
  text: z
    .string({ error: "text is required" })
    .trim()
    .min(1, "text is required")
    .max(2000, "text must be at most 2000 characters"),
});

export const triageOutputSchema = z.object({
  category: z.enum(["billing", "bug", "feature", "other"]),
  urgency: z.enum(["low", "normal", "high"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(300),
});

/** Deterministic fallback used by LLM_STUB=1 */
export const STUB_TRIAGE = {
  category: "other",
  urgency: "normal",
  confidence: 0.5,
  reason: "Stub mode — no model call was made.",
};

/** Kill-switch fallback when LLM_ENABLED=false */
export const KILL_SWITCH_TRIAGE = {
  category: "other",
  urgency: "normal",
  confidence: 0,
  reason: "LLM kill switch is off — deterministic fallback, no model call.",
};
