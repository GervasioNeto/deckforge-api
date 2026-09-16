import { Router } from "express";
import { HttpError } from "../../middlewares/error-handler";
import { getCardByName } from "./cards.service";

export const cardsRoutes = Router();

cardsRoutes.get("/cards", async (req, res, next) => {
    console.log("=== REQUISICAO CHEGOU ===");
  try {
    const { name } = req.query;

    if (!name || typeof name !== "string") {
      throw new HttpError(400, "O parâmetro 'name' é obrigatório.", "VALIDATION_ERROR");
    }

    const card = await getCardByName(name);

    return res.status(200).json(card);
  } catch (error) {
    console.error("Erro ao buscar carta:", error);
    next(error);
  }
});