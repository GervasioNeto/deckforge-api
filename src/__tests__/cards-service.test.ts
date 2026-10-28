import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  card: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock("../config/prisma", () => ({ prisma: db }));

// So as requisicoes sao mockadas: o registro de providers e os mappers sao os de verdade.
const pokemon = vi.hoisted(() => ({
  getPokemonCardById: vi.fn(),
  searchPokemonCardByName: vi.fn(),
  getPokemonCardsByNames: vi.fn(),
  autocompletePokemonCardNames: vi.fn(),
  searchPokemonCardPrints: vi.fn(),
  waitForPokemonTcg: vi.fn(),
}));

vi.mock("../modules/cards/providers/pokemon-tcg.provider", () => pokemon);

const scryfall = vi.hoisted(() => ({
  getCardById: vi.fn(),
  searchCardByName: vi.fn(),
  getCardsByNames: vi.fn(),
  waitForScryfall: vi.fn(),
}));

vi.mock("../modules/cards/providers/scryfall.provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/cards/providers/scryfall.provider")>()),
  ...scryfall,
}));

import { findOrFetchCard, getCardByName, getCardPrints, resolveCardsByNames } from "../modules/cards/cards.service";

const charizardRaw = {
  id: "me55c-4",
  name: "Charizard",
  supertype: "Pokémon",
  subtypes: ["Stage 2"],
  hp: "120",
  set: { id: "me55c", name: "30th Celebration: Classic Collection" },
  number: "4",
  images: { small: "https://images.pokemontcg.io/me55c/4.png", large: "https://images.pokemontcg.io/me55c/4_hires.png" },
};

const cachedCharizard = { id: "interno-1", externalId: "me55c-4", game: "pokemon", name: "Charizard", rawData: charizardRaw };

beforeEach(() => {
  vi.clearAllMocks();
  db.card.upsert.mockImplementation(async ({ create }: any) => ({ id: "interno-1", ...create }));
});

describe("cards.service com Pokémon", () => {
  it("busca o nome na Pokémon TCG API e grava a carta no cache como pokemon", async () => {
    db.card.findFirst.mockResolvedValue(null);
    pokemon.searchPokemonCardByName.mockResolvedValue(charizardRaw);

    const card = await getCardByName("charizard", "pokemon");

    expect(db.card.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "charizard", mode: "insensitive" }, game: "pokemon" },
    });
    expect(scryfall.searchCardByName).not.toHaveBeenCalled();
    expect(db.card.upsert).toHaveBeenCalledWith({
      where: { externalId_game: { externalId: "me55c-4", game: "pokemon" } },
      create: {
        externalId: "me55c-4",
        game: "pokemon",
        name: "Charizard",
        imageUrl: "https://images.pokemontcg.io/me55c/4_hires.png",
        text: null,
        rawData: charizardRaw,
      },
      update: {},
    });
    expect(card).toMatchObject({ id: "me55c-4", typeLine: "Pokémon — Stage 2", hp: 120 });
  });

  it("procura o id externo no cache só entre as cartas do jogo", async () => {
    db.card.findUnique.mockResolvedValue(cachedCharizard);

    const card = await findOrFetchCard({ externalId: "me55c-4" }, "pokemon");

    expect(card).toBe(cachedCharizard);
    expect(db.card.findUnique).toHaveBeenCalledWith({
      where: { externalId_game: { externalId: "me55c-4", game: "pokemon" } },
    });
    expect(pokemon.getPokemonCardById).not.toHaveBeenCalled();
  });

  it("importa a lista em lote, sem repetir a busca exata um a um para os nomes que faltaram", async () => {
    db.card.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([cachedCharizard]);
    pokemon.getPokemonCardsByNames.mockResolvedValue({ cards: [charizardRaw], notFound: ["Carta Inventada"] });

    const { found, notFound } = await resolveCardsByNames(["Charizard", "Carta Inventada"], "pokemon");

    expect(db.card.findMany.mock.calls[0][0].where.game).toBe("pokemon");
    expect(db.card.createMany.mock.calls[0][0].data[0]).toMatchObject({ externalId: "me55c-4", game: "pokemon" });
    expect(found.get("charizard")).toBe(cachedCharizard);
    expect(notFound).toEqual(["Carta Inventada"]);
    expect(pokemon.searchPokemonCardByName).not.toHaveBeenCalled();
  });

  it("lista as impressões só com o necessário para escolher a arte", async () => {
    pokemon.searchPokemonCardPrints.mockResolvedValue([charizardRaw]);

    await expect(getCardPrints("Charizard", "pokemon")).resolves.toEqual([
      {
        externalId: "me55c-4",
        name: "Charizard",
        imageUrl: "https://images.pokemontcg.io/me55c/4_hires.png",
        setName: "30th Celebration: Classic Collection",
        collectorNumber: "4",
      },
    ]);
  });
});

describe("cards.service com Magic", () => {
  it("continua buscando na Scryfall e gravando a carta como mtg", async () => {
    db.card.findUnique.mockResolvedValue(null);
    scryfall.getCardById.mockResolvedValue({ id: "bolt", name: "Lightning Bolt", oracle_text: "Deal 3 damage." });

    await findOrFetchCard({ externalId: "bolt" }, "mtg");

    expect(scryfall.getCardById).toHaveBeenCalledWith("bolt");
    expect(db.card.upsert.mock.calls[0][0].create).toMatchObject({ game: "mtg", text: "Deal 3 damage." });
  });

  it("tenta a busca aproximada com os nomes que o lote exato não achou", async () => {
    db.card.findMany.mockResolvedValue([]);
    scryfall.getCardsByNames.mockResolvedValue({ cards: [], notFound: ["Lightnig Bolt"] });
    scryfall.searchCardByName.mockResolvedValue({ id: "bolt", name: "Lightning Bolt" });

    const { found, notFound } = await resolveCardsByNames(["Lightnig Bolt"], "mtg");

    expect(scryfall.waitForScryfall).toHaveBeenCalled();
    expect(found.get("lightnig bolt")).toMatchObject({ externalId: "bolt", game: "mtg" });
    expect(notFound).toEqual([]);
  });
});

it("recusa um jogo sem provider", async () => {
  await expect(getCardByName("Pikachu", "yugioh")).rejects.toThrow("yugioh");
  expect(db.card.findFirst).not.toHaveBeenCalled();
});
