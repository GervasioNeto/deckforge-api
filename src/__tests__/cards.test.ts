import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { HttpError } from "../middlewares/error-handler";

// O app carrega todas as rotas: sem esses mocks, prisma e auth puxariam o env.
vi.mock("../config/prisma", () => ({ prisma: {} }));
vi.mock("../middlewares/auth", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { requireAuth: pass, optionalAuth: pass };
});

const cards = vi.hoisted(() => ({
  getCardByName: vi.fn(),
  getCardNameSuggestions: vi.fn(),
  getCardPrints: vi.fn(),
}));

vi.mock("../modules/cards/cards.service", () => ({
  ...cards,
  findOrFetchCard: vi.fn(),
  resolveCardsByNames: vi.fn(),
  cardNameKey: (name: string) => name.trim().toLowerCase(),
}));

import { app } from "../app";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /cards", () => {
  it("sem `game`, continua buscando carta de Magic", async () => {
    cards.getCardByName.mockResolvedValue({ id: "bolt", name: "Lightning Bolt" });

    const response = await request(app).get("/api/cards").query({ name: "Lightning Bolt" });

    expect(response.status).toBe(200);
    expect(cards.getCardByName).toHaveBeenCalledWith("Lightning Bolt", "mtg");
  });

  it("busca a carta do jogo pedido", async () => {
    cards.getCardByName.mockResolvedValue({ id: "me55c-4", name: "Charizard", hp: 120 });

    const response = await request(app).get("/api/cards").query({ name: "Charizard", game: "pokemon" });

    expect(response.status).toBe(200);
    expect(response.body.hp).toBe(120);
    expect(cards.getCardByName).toHaveBeenCalledWith("Charizard", "pokemon");
  });

  it("rejeita um jogo desconhecido sem chamar a API externa", async () => {
    const response = await request(app).get("/api/cards").query({ name: "Dark Magician", game: "yugioh" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(cards.getCardByName).not.toHaveBeenCalled();
  });

  it("rejeita um nome em branco", async () => {
    const response = await request(app).get("/api/cards").query({ name: "   " });

    expect(response.status).toBe(400);
    expect(cards.getCardByName).not.toHaveBeenCalled();
  });

  it("repassa o 404 da API externa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    cards.getCardByName.mockRejectedValue(new HttpError(404, "Carta 'Xyz' não encontrada.", "CARD_NOT_FOUND"));

    const response = await request(app).get("/api/cards").query({ name: "Xyz", game: "pokemon" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("CARD_NOT_FOUND");
  });
});

describe("GET /cards/autocomplete", () => {
  it("sugere nomes do jogo pedido", async () => {
    cards.getCardNameSuggestions.mockResolvedValue(["Charizard", "Charmander"]);

    const response = await request(app).get("/api/cards/autocomplete").query({ q: "char", game: "pokemon" });

    expect(response.body).toEqual({ names: ["Charizard", "Charmander"] });
    expect(cards.getCardNameSuggestions).toHaveBeenCalledWith("char", "pokemon");
  });
});

describe("GET /cards/search", () => {
  it("lista as impressões da carta no jogo pedido", async () => {
    const prints = [
      { externalId: "me55c-4", name: "Charizard", imageUrl: "https://img/1.png", setName: "30th Celebration", collectorNumber: "4" },
      { externalId: "base1-4", name: "Charizard", imageUrl: "https://img/2.png", setName: "Base", collectorNumber: "4" },
    ];
    cards.getCardPrints.mockResolvedValue(prints);

    const response = await request(app).get("/api/cards/search").query({ q: " Charizard ", game: "pokemon" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ prints });
    expect(cards.getCardPrints).toHaveBeenCalledWith("Charizard", "pokemon");
  });

  it("usa Magic quando o jogo não é informado", async () => {
    cards.getCardPrints.mockResolvedValue([]);

    const response = await request(app).get("/api/cards/search").query({ q: "Lightning Bolt" });

    expect(response.body).toEqual({ prints: [] });
    expect(cards.getCardPrints).toHaveBeenCalledWith("Lightning Bolt", "mtg");
  });

  it("exige o parâmetro `q`", async () => {
    const response = await request(app).get("/api/cards/search").query({ game: "pokemon" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(cards.getCardPrints).not.toHaveBeenCalled();
  });
});
