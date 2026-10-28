import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POKEMON_TCG_ATTEMPTS,
  autocompletePokemonCardNames,
  getPokemonCardById,
  getPokemonCardsByNames,
  searchPokemonCardByName,
  searchPokemonCardPrints,
} from "../modules/cards/providers/pokemon-tcg.provider";

// O env de verdade exige DATABASE_URL e companhia; aqui so a chave importa.
vi.mock("../config/env", () => ({ env: { pokemonTcgApiKey: "chave-de-teste" } }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Os parametros de busca da chamada `index` ao fetch.
const searchParams = (index = 0) => new URL(fetchMock.mock.calls[index][0]).searchParams;

describe("getPokemonCardsByNames", () => {
  it("busca 10 nomes por requisição e fica com a impressão mais nova de cada", async () => {
    const names = Array.from({ length: 12 }, (_, i) => `Carta ${i + 1}`);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          // Ja vem da mais nova pra mais antiga, como a API manda.
          data: [
            { id: "nova-1", name: "Carta 1" },
            { id: "velha-1", name: "Carta 1" },
            { id: "unica-2", name: "Carta 2" },
          ],
          totalCount: 3,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "unica-11", name: "Carta 11" }], totalCount: 1 }));

    const { cards, notFound } = await getPokemonCardsByNames(names);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(searchParams(0).get("q")).toBe(names.slice(0, 10).map((name) => `!name:"${name}"`).join(" OR "));
    expect(searchParams(0).get("orderBy")).toBe("-set.releaseDate");
    expect(searchParams(1).get("q")).toBe('!name:"Carta 11" OR !name:"Carta 12"');
    expect(cards.map((card) => card.id)).toEqual(["nova-1", "unica-2", "unica-11"]);
    expect(notFound).toEqual(names.filter((name) => !["Carta 1", "Carta 2", "Carta 11"].includes(name)));
  });

  it("busca um a um os nomes que uma página cheia deixou de fora", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "pikachu-1", name: "Pikachu" }], totalCount: 400 }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "raichu-1", name: "Raichu" }], totalCount: 1 }));

    const { cards, notFound } = await getPokemonCardsByNames(["Pikachu", "Raichu"]);

    expect(searchParams(1).get("q")).toBe('!name:"Raichu"');
    expect(cards.map((card) => card.id)).toEqual(["pikachu-1", "raichu-1"]);
    expect(notFound).toEqual([]);
  });
});

describe("autocompletePokemonCardNames", () => {
  it("transforma cada palavra num prefixo e ignora a pontuação", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await autocompletePokemonCardNames("Porygon-Z");

    expect(searchParams().get("q")).toBe("name:porygon* name:z*");
    expect(searchParams().get("select")).toBe("name");
  });

  it("tira os nomes repetidos e põe primeiro os que começam com o texto digitado", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [{ name: "Big Charm" }, { name: "Charizard" }, { name: "Charizard" }, { name: "Charmander" }],
      }),
    );

    await expect(autocompletePokemonCardNames("char")).resolves.toEqual(["Charizard", "Charmander", "Big Charm"]);
  });

  it("não consulta a API quando não sobra nenhuma palavra", async () => {
    await expect(autocompletePokemonCardNames("*!")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("searchPokemonCardPrints", () => {
  it("lista as impressões do nome exato, da mais nova para a mais antiga", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: "me55c-4" }, { id: "base1-4" }] }));

    const prints = await searchPokemonCardPrints("Charizard");

    expect(prints.map((card) => card.id)).toEqual(["me55c-4", "base1-4"]);
    expect(searchParams().get("q")).toBe('!name:"Charizard"');
    expect(searchParams().get("orderBy")).toBe("-set.releaseDate");
  });
});

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

  it("transforma o timeout em UPSTREAM_ERROR 504, sem tentar de novo", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    await expect(getPokemonCardById("base1-4")).rejects.toMatchObject({ status: 504, code: "UPSTREAM_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não repete o 404", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 404 } }, 404));

    await expect(getPokemonCardById("nao-existe")).rejects.toMatchObject({ code: "CARD_NOT_FOUND" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("tentativas", () => {
  // As pausas entre as tentativas passam no relogio falso, sem esperar de verdade.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tenta de novo quando a API falha na hora e devolve a carta", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("error code: 502", { status: 502 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({ data: { id: "base1-4" } }));

    const request = getPokemonCardById("base1-4");
    await vi.runAllTimersAsync();

    await expect(request).resolves.toEqual({ id: "base1-4" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("desiste depois de todas as tentativas, mesmo quando o corpo não é JSON", async () => {
    fetchMock.mockImplementation(async () => new Response("error code: 502", { status: 502 }));

    const request = getPokemonCardById("base1-4");
    const failed = expect(request).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
    await vi.runAllTimersAsync();

    await failed;
    expect(fetchMock).toHaveBeenCalledTimes(POKEMON_TCG_ATTEMPTS);
  });

  it("não repete um erro que não passa sozinho, como o limite de requisições", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 429 } }, 429));

    await expect(getPokemonCardById("base1-4")).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
