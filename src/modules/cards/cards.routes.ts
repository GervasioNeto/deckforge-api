import { Router } from "express";
import { HttpError } from "../../middlewares/error-handler";
import { getCardByName, getCardNameSuggestions } from "./cards.service";

export const cardsRoutes = Router();

// A Scryfall so responde o autocomplete a partir de 2 caracteres.
const AUTOCOMPLETE_MIN_LENGTH = 2;

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

cardsRoutes.get("/cards/autocomplete", async (req, res, next) => {
  try {
    const { q } = req.query;

    if (typeof q !== "string") {
      throw new HttpError(400, "O parâmetro 'q' é obrigatório.", "VALIDATION_ERROR");
    }

    const query = q.trim();
    const names = query.length < AUTOCOMPLETE_MIN_LENGTH ? [] : await getCardNameSuggestions(query);

    return res.status(200).json({ names });
  } catch (error) {
    next(error);
  }
});
