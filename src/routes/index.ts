import { Router } from "express";
import { healthRoutes } from "../modules/health/health.routes";
import { usersRoutes } from "../modules/users/users.routes";
import { cardsRoutes } from "../modules/cards/cards.routes";
import { decksRoutes } from "../modules/decks/decks.routes";

export const routes = Router();

routes.use(healthRoutes);
routes.use(usersRoutes);
routes.use(cardsRoutes);
routes.use(decksRoutes);
