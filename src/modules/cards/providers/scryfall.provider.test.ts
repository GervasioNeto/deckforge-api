import { describe, expect, it, vi } from "vitest";
import { mapScryfallCard, searchCardByName } from "./scryfall.provider";


describe("mapScryfallCard", () => {
  it("should map a raw Scryfall card to the expected format", () => {
    const rawCard = {
      id: "123",
      name: "Test Card",
      mana_cost: "{1}{G}",
      cmc: 2,
      type_line: "Creature — Elf",
      oracle_text: "This is a test card.",
      colors: ["G"],
      image_uris: { normal: "https://example.com/image.jpg" },
    };

    const expectedMappedCard = {
      id: "123",
      name: "Test Card",
      manaCost: "{1}{G}",
      cmc: 2,
      typeLine: "Creature — Elf",
      text: "This is a test card.",
      colors: ["G"],
      imageUrl: "https://example.com/image.jpg",
    };

    const mappedCard = mapScryfallCard(rawCard);
    expect(mappedCard).toEqual(expectedMappedCard);
  });
});

describe("searchCardByName", () => {
  it("should throw an error when the card is not found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ details: "Carta não encontrada" }),
    }));

    const invalidCardName = "NonExistentCardName";

    await expect(searchCardByName(invalidCardName)).rejects.toThrow(
      "Scryfall respondeu 404: Carta não encontrada"
    );
  });
});
