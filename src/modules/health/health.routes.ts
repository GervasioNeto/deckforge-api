import { Router } from "express";

export const healthRoutes = Router();

healthRoutes.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
