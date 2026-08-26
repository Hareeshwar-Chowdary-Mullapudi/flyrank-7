import { Router } from "express";
import { runTriage } from "../llm/complete.js";
import {
  KILL_SWITCH_TRIAGE,
  STUB_TRIAGE,
  triageInputSchema,
  triageOutputSchema,
} from "../llm/schema.js";

const router = Router();

router.post("/", async (req, res) => {
  const parsed = triageInputSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0] ?? "text";
    const message =
      issue?.code === "invalid_type" && field === "text"
        ? "text is required"
        : (issue?.message ?? "Invalid input");
    return res.status(400).json({ error: message, field });
  }

  // Kill switch first — production off-switch, zero model calls.
  if (process.env.LLM_ENABLED === "false") {
    return res.status(200).json(triageOutputSchema.parse(KILL_SWITCH_TRIAGE));
  }

  // Stub mode for local development without spending quota.
  if (process.env.LLM_STUB === "1") {
    return res.status(200).json(triageOutputSchema.parse(STUB_TRIAGE));
  }

  try {
    const result = await runTriage(parsed.data.text);
    return res.status(200).json(result.data);
  } catch (err) {
    if (err.status === 422) {
      return res.status(422).json({
        error: "Could not produce valid triage JSON",
        detail: err.message,
        prompt_version: err.meta?.prompt_version,
      });
    }

    if (err.status === 504 || err.name === "APIConnectionTimeoutError") {
      return res.status(504).json({
        error: "Model timed out",
        detail: err.message,
      });
    }

    const status = err?.status ?? err?.statusCode;
    if (status === 401 || status === 403) {
      return res.status(502).json({
        error: "LLM auth failed — check LLM_API_KEY (not retried)",
        detail: err.message,
      });
    }

    console.error("triage model error:", err?.message ?? err);
    return res.status(502).json({
      error: "Model call failed",
      detail: err?.message ?? "unknown error",
    });
  }
});

export default router;
