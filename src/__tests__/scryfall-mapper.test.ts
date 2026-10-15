import { describe, expect, it } from "vitest";
import { mapScryfallCard } from "../modules/cards/providers/scryfall.provider";

describe("mapScryfallCard", () => {
  it("usa a face da frente em cartas de duas faces, que não têm imagem nem custo na raiz", () => {
    const card = mapScryfallCard({
      id: "dfc",
      name: "Fable of the Mirror-Breaker // Reflection of Kiki-Jiki",
      cmc: 3,
      type_line: "Enchantment — Saga // Enchantment Creature — Goblin Shaman",
      card_faces: [
        {
          name: "Fable of the Mirror-Breaker",
          mana_cost: "{2}{R}",
          type_line: "Enchantment — Saga",
          oracle_text: "(As this Saga enters...)",
          image_uris: { normal: "https://img/front.jpg" },
        },
        {
          name: "Reflection of Kiki-Jiki",
          mana_cost: "",
          type_line: "Enchantment Creature — Goblin Shaman",
          oracle_text: "{1}, {T}: Create a token...",
          power: "2",
          toughness: "2",
          image_uris: { normal: "https://img/back.jpg" },
        },
      ],
    });

    expect(card.imageUrl).toBe("https://img/front.jpg");
    expect(card.backImageUrl).toBe("https://img/back.jpg");
    expect(card.manaCost).toBe("{2}{R}");
    expect(card.faces).toHaveLength(2);
    expect(card.faces?.[1].manaCost).toBeNull();
  });

  it("não inventa verso para cartas divididas, que têm uma imagem só", () => {
    const card = mapScryfallCard({
      id: "split",
      name: "Fire // Ice",
      mana_cost: "{1}{R} // {1}{U}",
      image_uris: { normal: "https://img/fire-ice.jpg" },
      card_faces: [{ name: "Fire" }, { name: "Ice" }],
    });

    expect(card.imageUrl).toBe("https://img/fire-ice.jpg");
    expect(card.backImageUrl).toBeNull();
    expect(card.manaCost).toBe("{1}{R} // {1}{U}");
  });

  it("normaliza terrenos sem custo para null", () => {
    const card = mapScryfallCard({ id: "land", name: "Watery Grave", mana_cost: "", cmc: 0 });

    expect(card.manaCost).toBeNull();
  });
});
