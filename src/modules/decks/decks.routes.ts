import { Router } from "express";
import { optionalAuth, requireAuth } from "../../middlewares/auth";
import {
  addCardToDeck,
  createDeck,
  deleteDeck,
  duplicateDeck,
  getDeckDetail,
  importCards,
  listPublicDecks,
  listUserDecks,
  moveCard,
  removeCardCopy,
  setCardQuantity,
  updateDeck,
} from "./decks.service";
import {
  assertCardId,
  assertDeckId,
  parseAddCard,
  parseBoard,
  parseCreateDeck,
  parseGame,
  parseImport,
  parseQuantity,
} from "./decks.validation";

// As rotas so validam a entrada e chamam o service; regras e acesso ao banco
// ficam em decks.service.ts. Documentacao: docs/decks.md.
export const decksRoutes = Router();

decksRoutes.post("/decks", requireAuth, async (req, res, next) => {
  try {
    const deck = await createDeck(req.user!.id, parseCreateDeck(req.body));
    return res.status(201).json(deck);
  } catch (error) {
    next(error);
  }
});

decksRoutes.get("/decks", requireAuth, async (req, res, next) => {
  try {
    return res.status(200).json(await listUserDecks(req.user!.id));
  } catch (error) {
    next(error);
  }
});

// Antes de /decks/:deckId, senao "public" cairia como um deckId.
decksRoutes.get("/decks/public", async (req, res, next) => {
  try {
    const { game } = req.query;
    const decks = await listPublicDecks(game === undefined ? undefined : parseGame(game));
    return res.status(200).json(decks);
  } catch (error) {
    next(error);
  }
});

// Sem login tambem funciona, pra decks publicos.
decksRoutes.get("/decks/:deckId", optionalAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;
    assertDeckId(deckId);
    return res.status(200).json(await getDeckDetail(deckId, req.user?.id));
  } catch (error) {
    next(error);
  }
});

decksRoutes.patch("/decks/:deckId", requireAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;
    assertDeckId(deckId);
    return res.status(200).json(await updateDeck(deckId, req.user!.id, req.body));
  } catch (error) {
    next(error);
  }
});

decksRoutes.delete("/decks/:deckId", requireAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;
    assertDeckId(deckId);
    await deleteDeck(deckId, req.user!.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

decksRoutes.post("/decks/:deckId/duplicate", requireAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;
    assertDeckId(deckId);
    return res.status(201).json(await duplicateDeck(deckId, req.user!.id));
  } catch (error) {
    next(error);
  }
});

decksRoutes.post("/decks/:deckId/cards", requireAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;
    assertDeckId(deckId);
    return res.status(200).json(await addCardToDeck(deckId, req.user!.id, parseAddCard(req.body)));
  } catch (error) {
    next(error);
  }
});

decksRoutes.post("/decks/:deckId/cards/import", requireAuth, async (req, res, next) => {
  try {
    const { deckId } = req.params;
    assertDeckId(deckId);
    const { entries, replace } = parseImport(req.body);
    return res.status(200).json(await importCards(deckId, req.user!.id, entries, replace));
  } catch (error) {
    next(error);
  }
});

// Quantidade exata de uma carta num board (`?board=`, padrao main); 0 remove.
decksRoutes.patch("/decks/:deckId/cards/:cardId", requireAuth, async (req, res, next) => {
  try {
    const { deckId, cardId } = req.params;
    assertDeckId(deckId);
    assertCardId(cardId);
    const board = parseBoard(req.query.board);
    const quantity = parseQuantity(req.body?.quantity, { min: 0 });
    return res.status(200).json(await setCardQuantity(deckId, cardId, req.user!.id, board, quantity));
  } catch (error) {
    next(error);
  }
});

decksRoutes.post("/decks/:deckId/cards/:cardId/move", requireAuth, async (req, res, next) => {
  try {
    const { deckId, cardId } = req.params;
    assertDeckId(deckId);
    assertCardId(cardId);
    const from = parseBoard(req.body?.from, "from");
    const to = parseBoard(req.body?.to, "to");
    const quantity = req.body?.quantity === undefined ? undefined : parseQuantity(req.body.quantity);
    return res.status(200).json(await moveCard(deckId, cardId, req.user!.id, { from, to, quantity }));
  } catch (error) {
    next(error);
  }
});

// Remove uma copia da carta do board (`?board=`, padrao main).
decksRoutes.delete("/decks/:deckId/cards/:cardId", requireAuth, async (req, res, next) => {
  try {
    const { deckId, cardId } = req.params;
    assertDeckId(deckId);
    assertCardId(cardId);
    const board = parseBoard(req.query.board);
    return res.status(200).json(await removeCardCopy(deckId, cardId, req.user!.id, board));
  } catch (error) {
    next(error);
  }
});
