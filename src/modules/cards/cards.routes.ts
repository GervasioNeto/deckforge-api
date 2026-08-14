import { Router } from "express";
import { getCardByName } from "./cards.service";

export const cardsRoutes = Router();

cardsRoutes.get("/cards", async (req, res) => {
    console.log("=== REQUISICAO CHEGOU ===");
  try {
    const { name } = req.query;

    if (!name || typeof name !== "string") {
      return res.status(400).json({
        error: "O parâmetro 'name' é obrigatório.",
      });
    }

    const card = await getCardByName(name);

    return res.status(200).json(card);
  } catch (error) {
    console.error("Erro ao buscar carta:", error);

    return res.status(500).json({
      error: "Erro interno ao buscar carta.",
    });
  }
});