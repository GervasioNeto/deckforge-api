import { Router } from "express";
import { healthRoutes } from "../modules/health/health.routes";

export const routes = Router();

routes.use(healthRoutes);

// Proximas etapas vao registrar aqui:
// routes.use(authRoutes);
// routes.use(deckRoutes);
// routes.use(cardRoutes);
