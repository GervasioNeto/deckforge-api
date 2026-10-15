import type { Card } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../middlewares/error-handler";
import {
  autocompleteCardNames,
  getCardById,
  getCardsByNames,
  mapScryfallCard,
  scryfallImageUrl,
  searchCardByName,
  waitForScryfall,
} from "./providers/scryfall.provider";

// So trata MTG por enquanto - quando entrar Pokemon, cada funcao daqui precisa
// receber o `game` e escolher o provider/mapper certo.
const MTG = "mtg";

// Quantos nomes do import ainda tentam a busca fuzzy (uma requisicao cada)
// depois que o lote exato falhou - o suficiente pra erros de digitacao, sem
// deixar um import todo errado prender a requisicao por muito tempo.
const FUZZY_FALLBACK_LIMIT = 15;

// Chave pra comparar nomes de carta sem diferenciar maiusculas.
export const cardNameKey = (name: string) => name.trim().toLowerCase();

function assertSupportedGame(game: string): void {
  if (game !== MTG) {
    throw new HttpError(400, `Cartas de '${game}' ainda não são suportadas.`, "GAME_NOT_SUPPORTED");
  }
}

function cardData(raw: any, game: string) {
  return {
    externalId: raw.id,
    game,
    name: raw.name,
    imageUrl: scryfallImageUrl(raw) ?? "",
    text: raw.oracle_text ?? null,
    rawData: raw,
  };
}

// Grava (ou reaproveita, se ja existir) a carta crua da Scryfall no cache.
export async function cacheScryfallCard(raw: any, game = MTG): Promise<Card> {
  return prisma.card.upsert({
    where: { externalId_game: { externalId: raw.id, game } },
    create: cardData(raw, game),
    update: {},
  });
}

// O mesmo, pra varias cartas em duas queries (em vez de uma por carta).
async function cacheScryfallCards(raws: any[], game = MTG): Promise<Card[]> {
  if (raws.length === 0) {
    return [];
  }
  await prisma.card.createMany({ data: raws.map((raw) => cardData(raw, game)), skipDuplicates: true });
  return prisma.card.findMany({ where: { game, externalId: { in: raws.map((raw) => raw.id) } } });
}

// Uma carta de duas faces casa pelo nome inteiro ("Fable of the Mirror-Breaker
// // Reflection of Kiki-Jiki") e pelo de cada face.
function cardAliases(card: Card): string[] {
  const faces = card.name.split(" // ");
  return faces.length > 1 ? [card.name, ...faces] : [card.name];
}

async function findOrFetchCardByName(name: string): Promise<Card> {
  const normalizedName = name.trim().replace(/\+/g, " ");
  const cached = await prisma.card.findFirst({
    where: {
      name: { equals: normalizedName, mode: "insensitive" },
      game: MTG,
    },
  });

  if (cached) {
    console.log(`Carta ${normalizedName} encontrada no cache.`);
    return cached;
  }

  console.log(`Carta ${normalizedName} não encontrada no cache. Buscando na Scryfall...`);
  return cacheScryfallCard(await searchCardByName(normalizedName));
}

async function findOrFetchCardByExternalId(externalId: string): Promise<Card> {
  const cached = await prisma.card.findUnique({ where: { externalId_game: { externalId, game: MTG } } });

  if (cached) {
    console.log(`Carta de ID ${externalId} encontrada no cache.`);
    return cached;
  }

  console.log(`Carta de ID ${externalId} não encontrada no cache. Buscando na Scryfall...`);
  return cacheScryfallCard(await getCardById(externalId));
}

export async function getCardByName(name: string) {
  const card = await findOrFetchCardByName(name);
  return mapScryfallCard(card.rawData);
}

export async function getCardNameSuggestions(query: string): Promise<string[]> {
  return autocompleteCardNames(query);
}

// A carta que vai entrar num deck, pelo id externo (resultado de uma busca)
// ou direto pelo nome (o que o usuario digitou/escolheu no autocomplete).
export async function findOrFetchCard(ref: { externalId?: string; name?: string }, game: string): Promise<Card> {
  assertSupportedGame(game);
  return ref.externalId ? findOrFetchCardByExternalId(ref.externalId) : findOrFetchCardByName(ref.name!);
}

// Resolve uma lista de nomes (import de deck): primeiro o cache, depois a
// Scryfall em lote pelo nome exato e, por fim, a busca fuzzy pros que sobraram.
// As chaves do mapa sao os nomes em minusculas.
export async function resolveCardsByNames(
  names: string[],
  game: string,
): Promise<{ found: Map<string, Card>; notFound: string[] }> {
  assertSupportedGame(game);
  const found = new Map<string, Card>();

  const remember = (card: Card) => {
    for (const alias of cardAliases(card)) {
      found.set(cardNameKey(alias), card);
    }
  };

  const cached = await prisma.card.findMany({
    where: {
      game: MTG,
      OR: names.flatMap((name) => [
        { name: { equals: name, mode: "insensitive" as const } },
        // So a face da frente de uma carta de duas faces.
        { name: { startsWith: `${name} // `, mode: "insensitive" as const } },
      ]),
    },
  });
  cached.forEach(remember);

  const missing = names.filter((name) => !found.has(cardNameKey(name)));
  if (missing.length > 0) {
    const { cards } = await getCardsByNames(missing);
    (await cacheScryfallCards(cards)).forEach(remember);

    const stillMissing = missing.filter((name) => !found.has(cardNameKey(name)));
    for (const name of stillMissing.slice(0, FUZZY_FALLBACK_LIMIT)) {
      await waitForScryfall();
      try {
        found.set(cardNameKey(name), await cacheScryfallCard(await searchCardByName(name)));
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 404)) {
          throw error;
        }
      }
    }
  }

  return { found, notFound: names.filter((name) => !found.has(cardNameKey(name))) };
}
