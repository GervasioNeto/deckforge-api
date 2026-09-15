import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// 1. mock de autenticacao
vi.mock("../middlewares/auth", () => {
  return {
    requireAuth: (req: any, res: any, next: any) => {
      req.user = {
        // ID mockado para agilizar teste
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "teste@deckforge.com",
      };
      next();
    },
  };
});

// 2. Mockando BD
vi.mock("../config/prisma", () => {
  return {
    prisma: {
      deck: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({
          id: "deck-falso-123",
          // ID, deck e nome mockado ja no BD-fake
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Meu Deck de Fogo",
          game: "pokemon",
          visibility: "public",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    },
  };
});

import { app } from "../app";

// A variavel dos mock
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
});
