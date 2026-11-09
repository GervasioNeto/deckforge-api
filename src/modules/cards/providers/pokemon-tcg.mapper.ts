// Fica separado do provider porque nao depende de nada (nem do env): os campos
// comuns tem o mesmo nome e formato dos do mapScryfallCard, pra resposta de
// carta ser igual nos dois jogos; o resto e' especifico de Pokemon.

// A API so lista os formatos em que a carta e' legal ou banida - ausente quer
// dizer que ela nao pode ser jogada ali.
const POKEMON_FORMATS = ["standard", "expanded", "unlimited"] as const;

// Normaliza os valores de legalidade para os mesmos usados pelo sistema ('legal', 'banned', 'not_legal').
function normalizeLegality(value: unknown): string {
  if (typeof value !== "string") {
    return "not_legal";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "legal") return "legal";
  if (normalized === "banned") return "banned";
  return "not_legal";
}

// Treinadores e Energias nao tem hp, ataques, fraquezas etc. - a API omite o
// campo em vez de mandar lista vazia.
const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);

function pokemonLegalities(cardLegalities: any, setLegalities: any): Record<string, string> {
  return Object.fromEntries(
    POKEMON_FORMATS.map((format) => {
      const cardVal = cardLegalities?.[format];
      if (cardVal !== undefined && cardVal !== null) {
        return [format, normalizeLegality(cardVal)];
      }
      const setVal = setLegalities?.[format];
      if (setVal !== undefined && setVal !== null) {
        return [format, normalizeLegality(setVal)];
      }
      return [format, "not_legal"];
    }),
  );
}

// Fallback resiliente para imagens: tenta imagem grande, cai para pequena, ou null.
function extractImageUrl(images: any): string | null {
  if (!images || typeof images !== "object") {
    return null;
  }
  const large = typeof images.large === "string" ? images.large.trim() : "";
  if (large) return large;
  const small = typeof images.small === "string" ? images.small.trim() : "";
  if (small) return small;
  return null;
}

export function mapPokemonCard(raw: any) {
  const subtypes: string[] = list(raw?.subtypes);

  return {
    id: raw?.id ?? "",
    name: raw?.name ?? "",
    // No formato da type_line do Magic: "Pokémon — Stage 1", "Trainer — Supporter".
    typeLine: [raw?.supertype, subtypes.join(" ")].filter(Boolean).join(" — "),
    imageUrl: extractImageUrl(raw?.images),
    rarity: raw?.rarity ?? null,
    setName: raw?.set?.name ?? null,
    // Sigla que o Pokémon TCG Live usa nas listas ("SVI", "PAL"); sets antigos
    // e algumas promos nao tem.
    setCode: raw?.set?.ptcgoCode ?? null,
    collectorNumber: raw?.number ?? null,
    // Cartas de set recem-lancado as vezes chegam sem `legalities` nenhum (nem
    // unlimited); ai vale a do set. Banimento sempre vem na propria carta.
    legalities: pokemonLegalities(raw?.legalities, raw?.set?.legalities),
    supertype: raw?.supertype ?? null,
    subtypes,
    // Nome do Pokémon de que este evolui; e' o que liga as linhas evolutivas.
    evolvesFrom: raw?.evolvesFrom ?? null,
    // A API manda o hp como texto ("120").
    hp: raw?.hp ? Number(raw.hp) : null,
    types: list(raw?.types),
    attacks: list(raw?.attacks).map((attack) => ({
      name: attack?.name ?? "",
      cost: list(attack?.cost),
      // Pode ter modificador ("30+", "20×") ou vir vazio, em ataque sem dano.
      damage: attack?.damage || null,
      text: attack?.text || null,
    })),
    abilities: list(raw?.abilities).map((ability) => ({
      name: ability?.name ?? "",
      type: ability?.type ?? null,
      text: ability?.text ?? null,
    })),
    weaknesses: list(raw?.weaknesses).map((item) => ({ type: item?.type ?? "", value: item?.value ?? "" })),
    resistances: list(raw?.resistances).map((item) => ({ type: item?.type ?? "", value: item?.value ?? "" })),
    retreatCost: list(raw?.retreatCost),
    regulationMark: raw?.regulationMark ?? null,
    rules: list(raw?.rules),
  };
}

export type MappedPokemonCard = ReturnType<typeof mapPokemonCard>;
