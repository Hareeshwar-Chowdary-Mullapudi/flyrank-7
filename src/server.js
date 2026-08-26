import express from "express";
import triageRoutes from "./routes/triage.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/triage", triageRoutes);

app.listen(PORT, () => {
  console.log(`A7 API listening on http://localhost:${PORT}`);
  console.log(`LLM_STUB=${process.env.LLM_STUB ?? "(unset)"} LLM_ENABLED=${process.env.LLM_ENABLED ?? "(unset)"}`);
});
