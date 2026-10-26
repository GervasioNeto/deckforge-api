import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const OWNER_ID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_ID = "99999999-9999-9999-9999-999999999999";
const DECK_ID = "11111111-1111-1111-1111-111111111111";
const CARD_ID = "22222222-2222-2222-2222-222222222222";

// Usuario logado em cada teste; null simula um visitante sem login.
const auth = vi.hoisted(() => ({ userId: "123e4567-e89b-12d3-a456-426614174000" as string | null }));

vi.mock("../middlewares/auth", () => {
  const withUser = (req: any, _res: any, next: any) => {
    if (auth.userId) {
      req.user = { id: auth.userId, email: "teste@deckforge.com" };
    }
    next();
  };
  return { requireAuth: withUser, optionalAuth: withUser };
});

const db = vi.hoisted(() => ({
  deck: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  deckCard: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock("../config/prisma", () => ({ prisma: db }));

const cards = vi.hoisted(() => ({
  findOrFetchCard: vi.fn(),
  resolveCardsByNames: vi.fn(),
  getCardNameSuggestions: vi.fn(),
}));

vi.mock("../modules/cards/cards.service", () => ({
  ...cards,
  getCardByName: vi.fn(),
  cardNameKey: (name: string) => name.trim().toLowerCase(),
}));

import { app } from "../app";

function deckRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DECK_ID,
    userId: OWNER_ID,
    name: "Dimir Control",
    game: "mtg",
    format: "standard",
    description: null,
    visibility: "private",
    coverCardId: null,
    shareToken: "token-123",
    createdAt: new Date("2026-10-01"),
    updatedAt: new Date("2026-10-02"),
    user: { id: OWNER_ID, name: "Dono" },
    deckCards: [
      {
        deckId: DECK_ID,
        cardId: CARD_ID,
        board: "main",
        quantity: 4,
        card: {
          id: CARD_ID,
          externalId: "scryfall-1",
          name: "Deceit",
          imageUrl: "https://cards.scryfall.io/normal/deceit.jpg",
          rawData: { id: "scryfall-1", name: "Deceit", mana_cost: "{4}{U}{B}", cmc: 6, type_line: "Creature" },
        },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.userId = OWNER_ID;
  db.deck.findFirst.mockResolvedValue(deckRow());
  db.$transaction.mockResolvedValue([]);
});

describe("GET /decks/:deckId", () => {
  it("mostra o deck ao dono, com o link de compartilhamento e sem o rawData", async () => {
    const response = await request(app).get(`/api/decks/${DECK_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.isOwner).toBe(true);
    expect(response.body.shareToken).toBe("token-123");
    expect(response.body.cardCount).toBe(4);
    expect(response.body.cards[0]).toMatchObject({ id: CARD_ID, externalId: "scryfall-1", board: "main", manaCost: "{4}{U}{B}" });
    expect(response.body.cards[0].rawData).toBeUndefined();
  });

  it("esconde um deck privado de outro usuário", async () => {
    auth.userId = OTHER_ID;

    const response = await request(app).get(`/api/decks/${DECK_ID}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("DECK_NOT_FOUND");
  });

  it("mostra um deck público a visitantes sem login, sem o link de compartilhamento", async () => {
    auth.userId = null;
    db.deck.findFirst.mockResolvedValue(deckRow({ visibility: "public" }));

    const response = await request(app).get(`/api/decks/${DECK_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.isOwner).toBe(false);
    expect(response.body.shareToken).toBeUndefined();
    expect(response.body.author).toEqual({ id: OWNER_ID, name: "Dono" });
  });
});

describe("PATCH /decks/:deckId", () => {
  it("atualiza só os campos enviados", async () => {
    const response = await request(app)
      .patch(`/api/decks/${DECK_ID}`)
      .send({ name: "  Novo nome  ", format: "modern" });

    expect(response.status).toBe(200);
    expect(db.deck.update).toHaveBeenCalledWith({ where: { id: DECK_ID }, data: { name: "Novo nome", format: "modern" } });
  });

  it("rejeita um formato que não existe no jogo do deck", async () => {
    const response = await request(app).patch(`/api/decks/${DECK_ID}`).send({ format: "expanded" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(db.deck.update).not.toHaveBeenCalled();
  });

  it("rejeita um corpo sem nenhum campo conhecido", async () => {
    const response = await request(app).patch(`/api/decks/${DECK_ID}`).send({});

    expect(response.status).toBe(400);
  });

  it("só aceita como capa uma carta que está no deck", async () => {
    db.deckCard.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .patch(`/api/decks/${DECK_ID}`)
      .send({ coverCardId: "33333333-3333-3333-3333-333333333333" });

    expect(response.status).toBe(400);
    expect(db.deck.update).not.toHaveBeenCalled();
  });
});

describe("cartas do deck", () => {
  it("adiciona várias cópias pelo nome direto no board escolhido", async () => {
    cards.findOrFetchCard.mockResolvedValue({ id: CARD_ID, name: "Deceit" });

    const response = await request(app)
      .post(`/api/decks/${DECK_ID}/cards`)
      .send({ name: "Deceit", quantity: 3, board: "side" });

    expect(response.status).toBe(200);
    expect(cards.findOrFetchCard).toHaveBeenCalledWith({ name: "Deceit" }, "mtg");
    expect(db.deckCard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { deckId: DECK_ID, cardId: CARD_ID, board: "side", quantity: 3 },
        update: { quantity: { increment: 3 } },
      }),
    );
  });

  it("rejeita um board desconhecido", async () => {
    const response = await request(app)
      .post(`/api/decks/${DECK_ID}/cards`)
      .send({ name: "Deceit", board: "graveyard" });

    expect(response.status).toBe(400);
  });

  it("quantidade 0 tira a carta do board", async () => {
    db.deckCard.findUnique.mockResolvedValue({ deckId: DECK_ID, cardId: CARD_ID, board: "main", quantity: 4 });

    const response = await request(app)
      .patch(`/api/decks/${DECK_ID}/cards/${CARD_ID}?board=main`)
      .send({ quantity: 0 });

    expect(response.status).toBe(200);
    expect(db.deckCard.delete).toHaveBeenCalled();
    expect(db.deckCard.update).not.toHaveBeenCalled();
  });

  it("devolve 404 ao mexer numa carta que não está no board", async () => {
    db.deckCard.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .patch(`/api/decks/${DECK_ID}/cards/${CARD_ID}?board=side`)
      .send({ quantity: 2 });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("CARD_NOT_IN_DECK");
  });

  it("move parte das cópias e soma no board de destino", async () => {
    db.deckCard.findUnique.mockResolvedValue({ deckId: DECK_ID, cardId: CARD_ID, board: "main", quantity: 4 });

    const response = await request(app)
      .post(`/api/decks/${DECK_ID}/cards/${CARD_ID}/move`)
      .send({ from: "main", to: "side", quantity: 1 });

    expect(response.status).toBe(200);
    expect(db.deckCard.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantity: { decrement: 1 } } }),
    );
    expect(db.deckCard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { quantity: { increment: 1 } } }),
    );
  });

  it("não move mais cópias do que existem", async () => {
    db.deckCard.findUnique.mockResolvedValue({ deckId: DECK_ID, cardId: CARD_ID, board: "main", quantity: 2 });

    const response = await request(app)
      .post(`/api/decks/${DECK_ID}/cards/${CARD_ID}/move`)
      .send({ from: "main", to: "side", quantity: 3 });

    expect(response.status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("POST /decks/:deckId/cards/import", () => {
  it("junta linhas repetidas e informa os nomes não reconhecidos", async () => {
    cards.resolveCardsByNames.mockResolvedValue({
      found: new Map([["deceit", { id: CARD_ID, name: "Deceit" }]]),
      notFound: ["Carta Inventada"],
    });

    const response = await request(app)
      .post(`/api/decks/${DECK_ID}/cards/import`)
      .send({
        entries: [
          { name: "Deceit", quantity: 2 },
          { name: "deceit", quantity: 1 },
          { name: "Carta Inventada", quantity: 4 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.imported).toBe(3);
    expect(response.body.notFound).toEqual(["Carta Inventada"]);
    expect(cards.resolveCardsByNames).toHaveBeenCalledWith(["Deceit", "Carta Inventada"], "mtg");
    // Um INSERT so, com uma linha por carta (as duas linhas de Deceit somadas).
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const [, rows] = db.$executeRaw.mock.calls[0];
    expect(rows.values).toEqual([DECK_ID, CARD_ID, "main", 3]);
    expect(db.deckCard.deleteMany).not.toHaveBeenCalled();
  });

  it("não apaga o deck quando nenhuma carta da lista é reconhecida", async () => {
    cards.resolveCardsByNames.mockResolvedValue({ found: new Map(), notFound: ["Xyz"] });

    const response = await request(app)
      .post(`/api/decks/${DECK_ID}/cards/import`)
      .send({ entries: [{ name: "Xyz", quantity: 1 }], replace: true });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("NO_CARDS_RECOGNIZED");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("POST /decks/:deckId/duplicate", () => {
  it("copia o deck público de outra pessoa como um deck privado", async () => {
    auth.userId = OTHER_ID;
    db.deck.findFirst.mockResolvedValue(deckRow({ visibility: "public" }));
    db.deck.create.mockImplementation(async ({ data }: any) => ({ id: "copia", ...data }));

    const response = await request(app).post(`/api/decks/${DECK_ID}/duplicate`);

    expect(response.status).toBe(201);
    expect(response.body.userId).toBe(OTHER_ID);
    expect(response.body.name).toBe("Dimir Control (cópia)");
    // Nao copia a visibilidade: a copia nasce com o padrao do banco (privado).
    expect(response.body.visibility).toBeUndefined();
  });

  it("não copia o deck privado de outra pessoa", async () => {
    auth.userId = OTHER_ID;

    const response = await request(app).post(`/api/decks/${DECK_ID}/duplicate`);

    expect(response.status).toBe(404);
    expect(db.deck.create).not.toHaveBeenCalled();
  });
});

describe("GET /cards/autocomplete", () => {
  it("não consulta a Scryfall com menos de 2 caracteres", async () => {
    const response = await request(app).get("/api/cards/autocomplete?q=a");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ names: [] });
    expect(cards.getCardNameSuggestions).not.toHaveBeenCalled();
  });

  it("devolve os nomes sugeridos", async () => {
    cards.getCardNameSuggestions.mockResolvedValue(["Lightning Bolt", "Lightning Helix"]);

    const response = await request(app).get("/api/cards/autocomplete?q=lightn");

    expect(response.body).toEqual({ names: ["Lightning Bolt", "Lightning Helix"] });
  });
});
