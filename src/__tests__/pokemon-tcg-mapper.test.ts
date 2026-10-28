import { describe, expect, it } from "vitest";
import { mapPokemonCard } from "../modules/cards/providers/pokemon-tcg.mapper";

// Respostas reais da Pokémon TCG API, sem os campos que o mapper ignora
// (preços, artista, detalhes do set...).
const charizard = {
  id: "base1-4",
  name: "Charizard",
  supertype: "Pokémon",
  subtypes: ["Stage 2"],
  hp: "120",
  types: ["Fire"],
  evolvesFrom: "Charmeleon",
  abilities: [
    {
      name: "Energy Burn",
      text: "As often as you like during your turn (before your attack), you may turn all Energy attached to Charizard into Fire Energy for the rest of the turn. This power can't be used if Charizard is Asleep, Confused, or Paralyzed.",
      type: "Pokémon Power",
    },
  ],
  attacks: [
    {
      name: "Fire Spin",
      cost: ["Fire", "Fire", "Fire", "Fire"],
      convertedEnergyCost: 4,
      damage: "100",
      text: "Discard 2 Energy cards attached to Charizard in order to use this attack.",
    },
  ],
  weaknesses: [{ type: "Water", value: "×2" }],
  resistances: [{ type: "Fighting", value: "-30" }],
  retreatCost: ["Colorless", "Colorless", "Colorless"],
  convertedRetreatCost: 3,
  set: { id: "base1", name: "Base" },
  number: "4",
  rarity: "Rare Holo",
  legalities: { unlimited: "Legal" },
  images: {
    small: "https://images.pokemontcg.io/base1/4.png",
    large: "https://images.pokemontcg.io/base1/4_hires.png",
  },
};

const lysandresTrumpCard = {
  id: "xy4-99",
  name: "Lysandre's Trump Card",
  supertype: "Trainer",
  subtypes: ["Supporter"],
  rules: [
    "Each player shuffles all cards in his or her discard pile into his or her deck (except for Lysandre's Trump Card).",
    "You may play only 1 Supporter card during your turn (before your attack).",
  ],
  set: { id: "xy4", name: "Phantom Forces" },
  number: "99",
  rarity: "Uncommon",
  legalities: { unlimited: "Legal", expanded: "Banned" },
  images: {
    small: "https://images.pokemontcg.io/xy4/99.png",
    large: "https://images.pokemontcg.io/xy4/99_hires.png",
  },
};

const basicFireEnergy = {
  id: "sve-2",
  name: "Basic Fire Energy",
  supertype: "Energy",
  subtypes: ["Basic"],
  set: { id: "sve", name: "Scarlet & Violet Energies" },
  number: "2",
  rarity: "Common",
  legalities: { unlimited: "Legal", standard: "Legal", expanded: "Legal" },
  images: {
    small: "https://images.pokemontcg.io/sve/2.png",
    large: "https://images.pokemontcg.io/sve/2_hires.png",
  },
};

describe("mapPokemonCard", () => {
  it("mapeia um Pokémon com os mesmos campos comuns do mapper da Scryfall", () => {
    const card = mapPokemonCard(charizard);

    expect(card).toMatchObject({
      id: "base1-4",
      name: "Charizard",
      typeLine: "Pokémon — Stage 2",
      imageUrl: "https://images.pokemontcg.io/base1/4_hires.png",
      rarity: "Rare Holo",
      setName: "Base",
      collectorNumber: "4",
    });
  });

  it("traz os campos próprios do Pokémon, com o hp como número", () => {
    const card = mapPokemonCard(charizard);

    expect(card.supertype).toBe("Pokémon");
    expect(card.subtypes).toEqual(["Stage 2"]);
    expect(card.hp).toBe(120);
    expect(card.types).toEqual(["Fire"]);
    expect(card.attacks).toEqual([
      {
        name: "Fire Spin",
        cost: ["Fire", "Fire", "Fire", "Fire"],
        damage: "100",
        text: "Discard 2 Energy cards attached to Charizard in order to use this attack.",
      },
    ]);
    expect(card.abilities).toEqual([
      { name: "Energy Burn", type: "Pokémon Power", text: charizard.abilities[0].text },
    ]);
    expect(card.weaknesses).toEqual([{ type: "Water", value: "×2" }]);
    expect(card.resistances).toEqual([{ type: "Fighting", value: "-30" }]);
    expect(card.retreatCost).toEqual(["Colorless", "Colorless", "Colorless"]);
    expect(card.regulationMark).toBeNull();
    expect(card.rules).toEqual([]);
  });

  it("marca como not_legal os formatos que a API omite", () => {
    const card = mapPokemonCard(charizard);

    expect(card.legalities).toEqual({ standard: "not_legal", expanded: "not_legal", unlimited: "legal" });
  });

  it("usa a legalidade do set quando a carta não traz nenhuma", () => {
    // Como veio o Charizard de 30th Celebration (me55c-4) logo após o lançamento.
    const { legalities, ...withoutLegalities } = charizard;
    const card = mapPokemonCard({
      ...withoutLegalities,
      set: {
        id: "me55c",
        name: "30th Celebration: Classic Collection",
        legalities: { unlimited: "Legal", standard: "Legal", expanded: "Legal" },
      },
    });

    expect(card.legalities).toEqual({ standard: "legal", expanded: "legal", unlimited: "legal" });
  });

  it("mapeia um Treinador, sem os campos de Pokémon e com a carta banida no Expanded", () => {
    const card = mapPokemonCard(lysandresTrumpCard);

    expect(card.typeLine).toBe("Trainer — Supporter");
    expect(card.rules).toHaveLength(2);
    expect(card.hp).toBeNull();
    expect(card.types).toEqual([]);
    expect(card.attacks).toEqual([]);
    expect(card.weaknesses).toEqual([]);
    expect(card.retreatCost).toEqual([]);
    expect(card.legalities).toEqual({ standard: "not_legal", expanded: "banned", unlimited: "legal" });
  });

  it("mapeia uma Energia, que não traz quase nenhum campo de jogo", () => {
    const card = mapPokemonCard(basicFireEnergy);

    expect(card.typeLine).toBe("Energy — Basic");
    expect(card.imageUrl).toBe("https://images.pokemontcg.io/sve/2_hires.png");
    expect(card.hp).toBeNull();
    expect(card.abilities).toEqual([]);
    expect(card.rules).toEqual([]);
    expect(card.regulationMark).toBeNull();
    expect(card.legalities).toEqual({ standard: "legal", expanded: "legal", unlimited: "legal" });
  });

  it("normaliza ataque sem dano nem texto para null", () => {
    const card = mapPokemonCard({
      ...charizard,
      attacks: [{ name: "Tail Whip", cost: ["Colorless"], damage: "", text: "" }],
    });

    expect(card.attacks[0]).toEqual({ name: "Tail Whip", cost: ["Colorless"], damage: null, text: null });
  });
});
