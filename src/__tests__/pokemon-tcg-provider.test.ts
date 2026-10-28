import { afterEach, describe, expect, it, vi } from "vitest";
import { getPokemonCardById, searchPokemonCardByName } from "../modules/cards/providers/pokemon-tcg.provider";

// O env de verdade exige DATABASE_URL e companhia; aqui so a chave importa.
vi.mock("../config/env", () => ({ env: { pokemonTcgApiKey: "chave-de-teste" } }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("searchPokemonCardByName", () => {
  it("busca pelo nome exato, da edição mais nova, mandando a chave e um timeout", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: "me55c-4", name: "Charizard" }] }));

    const card = await searchPokemonCardByName("Charizard");

    expect(card.id).toBe("me55c-4");
    const [url, init] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get("q")).toBe('!name:"Charizard"');
    expect(params.get("orderBy")).toBe("-set.releaseDate");
    expect(params.get("pageSize")).toBe("1");
    expect(init.headers["X-Api-Key"]).toBe("chave-de-teste");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("transforma a lista vazia em CARD_NOT_FOUND", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], count: 0, totalCount: 0 }));

    await expect(searchPokemonCardByName("Nao Existe")).rejects.toMatchObject({
      status: 404,
      code: "CARD_NOT_FOUND",
    });
  });
});

describe("getPokemonCardById", () => {
  it("devolve a carta de dentro do envelope `data`", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "base1-4", name: "Charizard" } }));

    await expect(getPokemonCardById("base1-4")).resolves.toEqual({ id: "base1-4", name: "Charizard" });
  });

  it("transforma o 404 da API em CARD_NOT_FOUND", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "The requested resource was not found.", code: 404 } }, 404),
    );

    await expect(getPokemonCardById("nao-existe")).rejects.toMatchObject({ status: 404, code: "CARD_NOT_FOUND" });
  });

  it("transforma erro da API em UPSTREAM_ERROR, mesmo quando o corpo não é JSON", async () => {
    fetchMock.mockResolvedValue(new Response("error code: 502", { status: 502 }));

    await expect(getPokemonCardById("base1-4")).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
  });

  it("transforma o timeout em UPSTREAM_ERROR 504", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    await expect(getPokemonCardById("base1-4")).rejects.toMatchObject({ status: 504, code: "UPSTREAM_ERROR" });
  });

  it("transforma falha de rede em UPSTREAM_ERROR 502", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(getPokemonCardById("base1-4")).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
  });
});
