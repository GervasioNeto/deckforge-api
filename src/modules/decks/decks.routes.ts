import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { prisma } from "../../config/prisma";

export const decksRoutes = Router();

decksRoutes.post("/decks", requireAuth, async (req, res) => {
    console.log("=== REQUISICAO Criação de DECKS CHEGOU ===");
  try {
    const { name, game, visibility } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({
        error: "The parameter 'name' is required.",
      });
    }

    if (!["mtg", "pokemon"].includes(game)) {
        return res.status(400).json({ error: "The field 'game' must be 'mtg' or 'pokemon'." });
    }

    if (visibility && !["public", "private"].includes(visibility)) {
    return res.status(400).json({ error: "The field 'visibility' must be 'public' or 'private'." });
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

    return res.status(500).json({
      error: "Internal error while creating deck.",
    });
  }
});