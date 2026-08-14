import { Router } from "express";
import { healthRoutes } from "../modules/health/health.routes";
import { usersRoutes } from "../modules/users/users.routes";

export const routes = Router();

routes.use(healthRoutes);
routes.use(usersRoutes);

// Proximas etapas vao registrar aqui:
// routes.use(deckRoutes);
// routes.use(cardRoutes);
