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
        // DB mockado pra buscar o deck junto das carta tudo
        findFirst: vi.fn().mockResolvedValue({
          id: "11111111-1111-1111-1111-111111111111",
          name: "Meu Deck de Fogo",
          game: "pokemon",
          visibility: "public",
          shareToken: "token-falso-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          deckCards: [
            {
              quantity: 2,
              card: {
                id: "card-123",
                name: "Charizard",
                imageUrl: "http://imagem.com/char.jpg",
              },
            },
          ],
        }),
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
    const response = await request(app).delete(
      "/api/decks/22222222-2222-2222-2222-222222222222",
    );

    // no mock acima, o count era 1, então deve chegar aqui
    expect(response.status).toBe(204);
  });

  // teste de DELETE caso dê falha: o deck não existe ou não é do user
  it("deve retornar 404 ao tentar deletar um deck que não existe", async () => {
    // Forçando o MockPrisma a retornar com count 0
    (prisma.deck.deleteMany as any).mockResolvedValueOnce({ count: 0 });

    const response = await request(app).delete(
      "/api/decks/33333333-3333-3333-3333-333333333333",
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("DECK_NOT_FOUND");
    expect(response.body.message).toBe("Deck not found.");
  });
  // --- TESTES DO GET /decks/:deckId ---

  it("deve retornar um deck específico com as suas cartas e status 200", async () => {
    const response = await request(app).get(
      "/api/decks/11111111-1111-1111-1111-111111111111",
    );

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Meu Deck de Fogo");
    // verifica se a formatacao file funfou, é pras cartas virem na raiz da Lista
    expect(Array.isArray(response.body.cards)).toBe(true);
    expect(response.body.cards[0].name).toBe("Charizard");
    expect(response.body.cards[0].quantity).toBe(2);
  });

  it("deve retornar 404 ao tentar buscar um deck que não existe", async () => {
    // força o findFirst pra voltar nulo so nesse teste aqui
    (prisma.deck.findFirst as any).mockResolvedValueOnce(null);

    const response = await request(app).get(
      "/api/decks/33333333-3333-3333-3333-333333333333",
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("DECK_NOT_FOUND");
  });

  it("deve retornar 400 ao tentar buscar um deck com ID no formato inválido", async () => {
    const response = await request(app).get(
      "/api/decks/id-invalido-que-nao-e-uuid",
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_DECK_ID");
  });
});
