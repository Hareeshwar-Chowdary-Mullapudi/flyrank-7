import { Router } from "express";
import { completeTriage } from "../llm/complete.js";
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
    const result = await completeTriage(parsed.data.text);
    // Stage 2: return the model text as-is (parse + schema come in Stage 3).
    return res.status(200).json({
      answer: result.answer,
      prompt_version: result.prompt_version,
      model: result.model,
    });
  } catch (err) {
    console.error("triage model error:", err?.message ?? err);
    return res.status(502).json({
      error: "Model call failed",
      detail: err?.message ?? "unknown error",
    });
  }
});

export default router;
