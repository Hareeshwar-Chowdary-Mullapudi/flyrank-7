import { Router } from "express";
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

  // Stage 1: stub only. Real model call comes in Stage 2+.
  if (stubOn || !enabled) {
    const output = triageOutputSchema.parse(STUB_TRIAGE);
    return res.status(200).json(output);
  }

  return res.status(501).json({
    error: "Live model path not wired yet — set LLM_STUB=1 or continue to Stage 2",
  });
});

export default router;
