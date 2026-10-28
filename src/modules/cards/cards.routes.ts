import { Router } from "express";
import { HttpError } from "../../middlewares/error-handler";
import type { Game } from "../decks/decks.constants";
import { parseGame } from "../decks/decks.validation";
import { getCardByName, getCardNameSuggestions, getCardPrints } from "./cards.service";

// Documentacao: docs/cards.md.
export const cardsRoutes = Router();

// A Scryfall so responde o autocomplete a partir de 2 caracteres; na Pokemon
// TCG API, 1 caractere so traria metade das cartas.
const AUTOCOMPLETE_MIN_LENGTH = 2;

// `?game=` e' opcional: sem ele vale Magic, como antes de existir Pokemon.
function parseCardGame(value: unknown): Game {
  return value === undefined ? "mtg" : parseGame(value);
}

function requiredQuery(value: unknown, param: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `O parâmetro '${param}' é obrigatório.`, "VALIDATION_ERROR");
  }
  return value.trim();
}

cardsRoutes.get("/cards", async (req, res, next) => {
  try {
    const name = requiredQuery(req.query.name, "name");
    const card = await getCardByName(name, parseCardGame(req.query.game));

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

    const game = parseCardGame(req.query.game);
    const query = q.trim();
    const names = query.length < AUTOCOMPLETE_MIN_LENGTH ? [] : await getCardNameSuggestions(query, game);

    return res.status(200).json({ names });
  } catch (error) {
    next(error);
  }
});

// As impressoes de uma carta (`q` e' o nome exato), pra escolher a arte antes
// de adicionar ao deck pelo externalId.
cardsRoutes.get("/cards/search", async (req, res, next) => {
  try {
    const name = requiredQuery(req.query.q, "q");
    const prints = await getCardPrints(name, parseCardGame(req.query.game));

    return res.status(200).json({ prints });
  } catch (error) {
    next(error);
  }
});
