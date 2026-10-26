import { HttpError } from "../../../middlewares/error-handler";

const SCRYFALL_BASE_URL = "https://api.scryfall.com";

const SCRYFALL_HEADERS = {
  "User-Agent": "DeckForge/0.1 gervasiioneto@gmail.com",
  Accept: "application/json",
};

// Limite do POST /cards/collection da Scryfall.
const COLLECTION_BATCH_SIZE = 75;

// A Scryfall pede no maximo ~10 requisicoes/s; esse intervalo entre chamadas
// em sequencia (lotes do import, fallbacks fuzzy) mantem a gente bem abaixo.
export const SCRYFALL_REQUEST_GAP_MS = 100;

export const waitForScryfall = () => new Promise((resolve) => setTimeout(resolve, SCRYFALL_REQUEST_GAP_MS));

// Cartas de duas faces (transform, MDFC) nao tem image_uris na raiz, so em
// cada face - sem esse fallback elas ficavam sem imagem nenhuma.
export function scryfallImageUrl(raw: any): string | null {
  return raw?.image_uris?.normal ?? raw?.card_faces?.[0]?.image_uris?.normal ?? null;
}

export function mapScryfallCard(raw: any) {
  const faces: any[] = Array.isArray(raw?.card_faces) ? raw.card_faces : [];
  const front = faces[0];
  // So transform/MDFC tem imagem por face; split e adventure dividem uma imagem.
  const hasFaceImages = !raw?.image_uris && faces.length > 1;

  return {
    id: raw.id,
    name: raw.name,
    // Terrenos vem com mana_cost "" - normalizado pra null.
    manaCost: (raw.mana_cost ?? front?.mana_cost) || null,
    cmc: raw.cmc ?? 0,
    typeLine: raw.type_line ?? front?.type_line ?? "",
    text:
      raw.oracle_text ??
      (faces
        .map((face) => face.oracle_text)
        .filter(Boolean)
        .join("\n\n") ||
        null),
    colors: raw.colors ?? front?.colors ?? [],
    colorIdentity: raw.color_identity ?? [],
    rarity: raw.rarity ?? null,
    setCode: raw.set ?? null,
    setName: raw.set_name ?? null,
    collectorNumber: raw.collector_number ?? null,
    imageUrl: scryfallImageUrl(raw),
    backImageUrl: hasFaceImages ? (faces[1]?.image_uris?.normal ?? null) : null,
    power: raw.power ?? front?.power ?? null,
    toughness: raw.toughness ?? front?.toughness ?? null,
    loyalty: raw.loyalty ?? front?.loyalty ?? null,
    faces:
      faces.length > 1
        ? faces.map((face) => ({
            name: face.name,
            manaCost: face.mana_cost || null,
            typeLine: face.type_line ?? "",
            text: face.oracle_text ?? null,
            power: face.power ?? null,
            toughness: face.toughness ?? null,
            loyalty: face.loyalty ?? null,
          }))
        : null,
    legalities: raw.legalities ?? {},
    scryfallUrl: raw.scryfall_uri ?? null,
  };
}

export type MappedCard = ReturnType<typeof mapScryfallCard>;

async function scryfallRequest(path: string, init: RequestInit = {}, notFoundMessage?: string) {
  const response = await fetch(`${SCRYFALL_BASE_URL}${path}`, {
    ...init,
    headers: init.body ? { ...SCRYFALL_HEADERS, "Content-Type": "application/json" } : SCRYFALL_HEADERS,
  });

  const data = (await response.json()) as any;

  if (!response.ok) {
    if (response.status === 404 && notFoundMessage) {
      throw new HttpError(404, notFoundMessage, "CARD_NOT_FOUND");
    }
    throw new HttpError(502, `Scryfall respondeu ${response.status}: ${data.details ?? "erro desconhecido"}`, "UPSTREAM_ERROR");
  }

  return data;
}

export async function getCardById(externalId: string) {
  return scryfallRequest(
    `/cards/${encodeURIComponent(externalId)}`,
    {},
    `Carta com ID '${externalId}' não encontrada na Scryfall.`,
  );
}

export async function searchCardByName(name: string) {
  return scryfallRequest(`/cards/named?fuzzy=${encodeURIComponent(name)}`, {}, `Carta '${name}' não encontrada.`);
}

// Ate 20 nomes que batem com `query`. Nao grava nada no cache: sao so nomes,
// a carta em si so e' buscada quando o usuario escolhe uma.
export async function autocompleteCardNames(query: string): Promise<string[]> {
  const data = await scryfallRequest(`/cards/autocomplete?q=${encodeURIComponent(query)}`);
  return Array.isArray(data.data) ? data.data : [];
}

// Busca varias cartas pelo nome exato, em lotes de 75 (POST /cards/collection).
// Retorna as cartas cruas da Scryfall e os nomes que ela nao reconheceu.
export async function getCardsByNames(names: string[]): Promise<{ cards: any[]; notFound: string[] }> {
  const cards: any[] = [];
  const notFound: string[] = [];

  for (let start = 0; start < names.length; start += COLLECTION_BATCH_SIZE) {
    if (start > 0) {
      await waitForScryfall();
    }

    const batch = names.slice(start, start + COLLECTION_BATCH_SIZE);
    const data = await scryfallRequest("/cards/collection", {
      method: "POST",
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    });

    cards.push(...(data.data ?? []));
    for (const identifier of data.not_found ?? []) {
      if (identifier?.name) {
        notFound.push(identifier.name);
      }
    }
  }

  return { cards, notFound };
}
