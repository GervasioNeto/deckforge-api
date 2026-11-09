import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { prisma } from "../config/prisma";

const USER_ID = "123e4567-e89b-12d3-a456-426614174000";

vi.mock("../middlewares/auth", () => {
  const loggedIn = (req: any, _res: any, next: any) => {
    req.user = { id: "123e4567-e89b-12d3-a456-426614174000", email: "teste@deckforge.com" };
    next();
  };
  return { requireAuth: loggedIn, optionalAuth: loggedIn };
});

vi.mock("../config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    deck: { findMany: vi.fn() },
  },
}));

describe("rotas de usuarios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH /me salva o nome sem espacos nas pontas", async () => {
    (prisma.user.findUnique as any).mockResolvedValueOnce({ id: USER_ID, name: "" });
    (prisma.user.update as any).mockResolvedValueOnce({ id: USER_ID, name: "Emerson" });

    const response = await request(app).patch("/api/me").send({ name: "  Emerson " });

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID }, data: expect.objectContaining({ name: "Emerson" }) }),
    );
  });

  it.each([[""], ["   "], ["x".repeat(61)], [123]])("PATCH /me rejeita o nome %j", async (name) => {
    const response = await request(app).patch("/api/me").send({ name });

    expect(response.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("GET /users/search devolve contagem de decks publicos e nunca o email", async () => {
    (prisma.user.findMany as any).mockResolvedValueOnce([
      { id: USER_ID, name: "Emerson", createdAt: "2026-09-15T10:00:00Z", _count: { decks: 3 } },
    ]);

    const response = await request(app).get("/api/users/search?q=eme");

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([
      { id: USER_ID, name: "Emerson", createdAt: "2026-09-15T10:00:00Z", publicDeckCount: 3 },
    ]);
    const select = (prisma.user.findMany as any).mock.calls[0][0].select;
    expect(select.email).toBeUndefined();
  });

  it("GET /users/search com menos de 2 caracteres nao consulta o banco", async () => {
    const response = await request(app).get("/api/users/search?q=e");

    expect(response.body).toEqual({ users: [] });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("GET /users/:id troca nome vazio pelo padrao e esconde o shareToken", async () => {
    (prisma.user.findUnique as any).mockResolvedValueOnce({ id: USER_ID, name: "", createdAt: "2026-09-15T10:00:00Z" });
    (prisma.deck.findMany as any).mockResolvedValueOnce([
      { id: "d1", name: "Deck", shareToken: "segredo", coverCard: null, deckCards: [] },
    ]);

    const response = await request(app).get(`/api/users/${USER_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Jogador");
    expect(response.body.decks[0].shareToken).toBeUndefined();
  });
});
