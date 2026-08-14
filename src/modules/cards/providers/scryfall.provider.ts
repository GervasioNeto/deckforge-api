const SCRYFALL_BASE_URL = "https://api.scryfall.com";

export function mapScryfallCard(raw: any) {
  return {
    id: raw.id,
    name: raw.name,
    manaCost: raw.mana_cost ?? null,
    cmc: raw.cmc,
    typeLine: raw.type_line,
    text: raw.oracle_text ?? null,
    colors: raw.colors ?? [],
    imageUrl: raw.image_uris?.normal ?? null,
  };
}

export async function searchCardByName(name: string) {
  const response = await fetch(
    `${SCRYFALL_BASE_URL}/cards/named?fuzzy=${encodeURIComponent(name)}`,
    { headers: { "User-Agent": "DeckForge/0.1 gervasiioneto@gmail.com", "Accept": "application/json" } }
  );

const data = (await response.json()) as any;

  if (!response.ok) {
    throw new Error(`Scryfall respondeu ${response.status}: ${data.details ?? "erro desconhecido"}`);
  }

  return data;
}