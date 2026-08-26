import { Router } from "express";
import { runTriage } from "../llm/complete.js";
import {
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

  const stubOn = process.env.LLM_STUB === "1";
  const enabled = process.env.LLM_ENABLED !== "false";

  if (stubOn || !enabled) {
    const output = triageOutputSchema.parse(STUB_TRIAGE);
    return res.status(200).json(output);
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

    console.error("triage model error:", err?.message ?? err);
    return res.status(502).json({
      error: "Model call failed",
      detail: err?.message ?? "unknown error",
    });
  }
});

export default router;
