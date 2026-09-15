import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Teste via dados mockados para passar verificação do Middleware
// Precisamos fazer isso ANTES de importar o 'app'.
vi.mock("../middlewares/auth", () => {
  return {
    requireAuth: (req: any, res: any, next: any) => {
      req.user = {
        // 💡 Mudamos para um UUID válido (pode ser qualquer um, desde que siga esse padrão)
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "teste@deckforge.com",
      };

      next();
    },
  };
});

// 2. Agora sim importamos o app. Ele vai rodar achando que a autenticação foi um sucesso.
import { app } from "../app";

describe("Testes da Rota de Decks", () => {
  it("deve retornar status 200 ao buscar a lista de decks", async () => {
    // Ação: Disparamos o GET. Note que nem precisamos mandar token!
    const response = await request(app).get("/api/decks");

    // Garantia: Esperamos que agora o status seja 200 (Sucesso)
    expect(response.status).toBe(200);

    // Garantia: Verificamos se o que voltou é uma lista
    expect(Array.isArray(response.body)).toBe(true);
  });
});
