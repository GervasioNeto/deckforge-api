import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { isValidUuid } from "../../utils/validators";
import { addCardToDeck, removeCardFromDeck } from "../cards/cards.service";

export const decksRoutes = Router();

decksRoutes.post("/decks", requireAuth, async (req, res, next) => {
    console.log("=== REQUISICAO Criação de DECKS CHEGOU ===");
  try {
    const { name, game, visibility } = req.body;

    if (!name || typeof name !== "string") {
      throw new HttpError(400, "The parameter 'name' is required.", "VALIDATION_ERROR");
    }

    if (!["mtg", "pokemon"].includes(game)) {
      throw new HttpError(400, "The field 'game' must be 'mtg' or 'pokemon'.", "VALIDATION_ERROR");
    }

    if (visibility && !["public", "private"].includes(visibility)) {
      throw new HttpError(400, "The field 'visibility' must be 'public' or 'private'.", "VALIDATION_ERROR");
    }

    const deck = await prisma.deck.create({
        data: {
            userId: req.user!.id,
            name,
            game,
            ...(visibility ? { visibility } : {}),
        },
    });

    return res.status(201).json(deck);
  } catch (error) {
    console.error("Error creating deck:", error);
    next(error);
  }
});

decksRoutes.post("/decks/:deckId/cards", requireAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;
    const { externalId } = req.body;

    if (!isValidUuid(deckId)) {
      throw new HttpError(400, `'${deckId}' não é um ID de deck válido.`, "INVALID_DECK_ID");
    }

    if (!externalId || typeof externalId !== "string") {
      throw new HttpError(400, "The parameter 'externalId' is required.", "VALIDATION_ERROR");
    }

    await addCardToDeck(deckId, externalId, req.user!.id);

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

decksRoutes.get("/decks", requireAuth, async (req, res, next) => {
  try {
    const decks = await prisma.deck.findMany({
      where: {userId: req.user!.id},
      orderBy: {createdAt: "desc"}
    });
    return res.status(200).json(decks)
  } catch (error) {
    next(error);
  }
});

decksRoutes.get("/decks/:deckId", requireAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;

    // valida se o id da url veio de um uuid valido
    if (!isValidUuid(deckId)) {
      throw new HttpError(
        400,
        `'${deckId}' não é um ID de deck válido.`,
        "INVALID_DECK_ID",
      );
    }

    // faz a busca do deck do user que ta on, com as cards
    const deck = await prisma.deck.findFirst({
      where: {
        id: deckId,
        userId: req.user!.id, // o user so pode ver o proprio deck
      },
      include: {
        deckCards: {
          include: {
            card: true, // traz todos aqueles dados da tabela card, pra carta
          },
        },
      },
    });

    // se nao achar, vem ai um 404
    if (!deck) {
      throw new HttpError(404, "Deck not found.", "DECK_NOT_FOUND");
    }

    // formatando os dados pra virem filé
    const formattedDeck = {
      id: deck.id,
      name: deck.name,
      game: deck.game,
      visibility: deck.visibility,
      shareToken: deck.shareToken,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      // pega as cartas e poe todas em uma lista pra ficar mais legivel
      cards: deck.deckCards.map((dc) => ({
        ...dc.card,
        quantity: dc.quantity,
      })),
    };

    return res.status(200).json(formattedDeck);
  } catch (error) {
    next(error);
  }
});

decksRoutes.delete("/decks/:deckId", requireAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;

    if (!isValidUuid(deckId)) {
      throw new HttpError(400, `'${deckId}' não é um ID de deck válido.`, "INVALID_DECK_ID");
    }

    const result = await prisma.deck.deleteMany({
      where: {
        id: deckId,
        userId: req.user!.id,
      },
    });

    if (result.count === 0) {
      throw new HttpError(404, "Deck not found.", "DECK_NOT_FOUND");
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

decksRoutes.delete("/decks/:deckId/cards/:cardId", requireAuth, async (req, res, next) => {
  try {
    const { deckId, cardId } = req.params;

    if (!isValidUuid(deckId)) {
      throw new HttpError(400, `'${deckId}' não é um ID de deck válido.`, "INVALID_DECK_ID");
    }

    await removeCardFromDeck(deckId, cardId, req.user!.id);

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});
