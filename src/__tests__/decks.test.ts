import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// import do prisma para criar todo o mock, agilizando os testes
import { prisma } from "../config/prisma";

// 1. Mock de Autenticação
vi.mock("../middlewares/auth", () => {
  return {
    requireAuth: (req: any, res: any, next: any) => {
      req.user = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "teste@deckforge.com",
      };
      next();
    },
  };
});

// 2. Mock do BD
vi.mock("../config/prisma", () => {
  return {
    prisma: {
      deck: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({
          id: "deck-falso-123",
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Meu Deck de Fogo",
          game: "pokemon",
          visibility: "public",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        // mock para que o DELETE sempre seja 1
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    },
  };
});

// 3. Mock do Service de Cartas
vi.mock("../modules/cards/cards.service", () => {
  return {
    addCardToDeck: vi.fn().mockResolvedValue(true),
  };
});

import { app } from "../app";

const MOCK_USER_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("Testes da Rota de Decks", () => {
  it("deve retornar status 200 ao buscar a lista de decks", async () => {
    const response = await request(app).get("/api/decks");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("deve criar um novo deck com sucesso e retornar status 201", async () => {
    const novoDeck = {
      name: "Meu Deck de Fogo",
      game: "pokemon",
      visibility: "public",
    };

    const response = await request(app).post("/api/decks").send(novoDeck);
    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Meu Deck de Fogo");
    expect(response.body.game).toBe("pokemon");
    expect(response.body.userId).toBe(MOCK_USER_ID);
  });

  it("deve adicionar uma carta ao deck com sucesso e retornar status 204", async () => {
    const bodyCarta = {
      externalId: "pikachu-vmax-001",
    };

    const response = await request(app)
      .post("/api/decks/11111111-1111-1111-1111-111111111111/cards")
      .send(bodyCarta);
    expect(response.status).toBe(204);
  });

  // Teste para sucesso em deletar
  it("deve deletar um deck com sucesso e retornar status 204", async () => {
    // Mandamos o DELETE para um ID qualquer
    const response = await request(app).delete("/api/decks/22222222-2222-2222-2222-222222222222");

    // no mock acima, o count era 1, então deve chegar aqui
    expect(response.status).toBe(204);
  });

  // teste de DELETE caso dê falha: o deck não existe ou não é do user
  it("deve retornar 404 ao tentar deletar um deck que não existe", async () => {
    // Forçando o MockPrisma a retornar com count 0
    (prisma.deck.deleteMany as any).mockResolvedValueOnce({ count: 0 });

    const response = await request(app).delete("/api/decks/33333333-3333-3333-3333-333333333333");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("DECK_NOT_FOUND");
    expect(response.body.message).toBe("Deck not found.");
  });
});
