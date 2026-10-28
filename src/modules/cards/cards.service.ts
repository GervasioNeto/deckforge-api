import type { Card } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { cardText, mapCard, toCardPrint } from "./cards.mapper";
import { getCardProvider } from "./cards.providers";

// Cada jogo busca na sua API (ver cards.providers.ts), mas o cache e' um so:
// toda linha guarda o `game`, e as buscas no cache filtram por ele.

// Quantos nomes do import ainda tentam a busca aproximada (uma requisicao cada)
// depois que o lote exato falhou - o suficiente pra erros de digitacao, sem
// deixar um import todo errado prender a requisicao por muito tempo.
const FUZZY_FALLBACK_LIMIT = 15;

// Chave pra comparar nomes de carta sem diferenciar maiusculas.
export const cardNameKey = (name: string) => name.trim().toLowerCase();

function cardData(raw: any, game: string) {
  return {
    externalId: raw.id,
    game,
    name: raw.name,
    imageUrl: mapCard(game, raw).imageUrl ?? "",
    text: cardText(game, raw),
    rawData: raw,
  };
}

// Grava (ou reaproveita, se ja existir) a carta crua no cache.
async function cacheCard(raw: any, game: string): Promise<Card> {
  return prisma.card.upsert({
    where: { externalId_game: { externalId: raw.id, game } },
    create: cardData(raw, game),
    update: {},
  });
}

// O mesmo, pra varias cartas em duas queries (em vez de uma por carta).
async function cacheCards(raws: any[], game: string): Promise<Card[]> {
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

async function findOrFetchCardByName(name: string, game: string): Promise<Card> {
  const provider = getCardProvider(game);
  const normalizedName = name.trim().replace(/\+/g, " ");
  const cached = await prisma.card.findFirst({
    where: {
      name: { equals: normalizedName, mode: "insensitive" },
      game,
    },
  });

  if (cached) {
    console.log(`Carta ${normalizedName} encontrada no cache.`);
    return cached;
  }

  console.log(`Carta ${normalizedName} não encontrada no cache. Buscando na ${provider.name}...`);
  return cacheCard(await provider.searchCardByName(normalizedName), game);
}

async function findOrFetchCardByExternalId(externalId: string, game: string): Promise<Card> {
  const provider = getCardProvider(game);
  const cached = await prisma.card.findUnique({ where: { externalId_game: { externalId, game } } });

  if (cached) {
    console.log(`Carta de ID ${externalId} encontrada no cache.`);
    return cached;
  }

  console.log(`Carta de ID ${externalId} não encontrada no cache. Buscando na ${provider.name}...`);
  return cacheCard(await provider.getCardById(externalId), game);
}

export async function getCardByName(name: string, game: string) {
  const card = await findOrFetchCardByName(name, game);
  return mapCard(game, card.rawData);
}

export async function getCardNameSuggestions(query: string, game: string): Promise<string[]> {
  return getCardProvider(game).autocompleteCardNames(query);
}

// As impressoes de uma carta, pra escolher a arte. Nao grava nada no cache,
// como o autocomplete: a carta escolhida entra depois pelo externalId.
export async function getCardPrints(name: string, game: string) {
  const prints = await getCardProvider(game).searchCardPrints(name);
  return prints.map((raw) => toCardPrint(game, raw));
}

// A carta que vai entrar num deck, pelo id externo (resultado de uma busca)
// ou direto pelo nome (o que o usuario digitou/escolheu no autocomplete).
export async function findOrFetchCard(ref: { externalId?: string; name?: string }, game: string): Promise<Card> {
  return ref.externalId ? findOrFetchCardByExternalId(ref.externalId, game) : findOrFetchCardByName(ref.name!, game);
}

// Resolve uma lista de nomes (import de deck): primeiro o cache, depois a API
// em lote pelo nome exato e, se ela tiver busca aproximada (Scryfall), essa
// busca pros que sobraram. As chaves do mapa sao os nomes em minusculas.
export async function resolveCardsByNames(
  names: string[],
  game: string,
): Promise<{ found: Map<string, Card>; notFound: string[] }> {
  const provider = getCardProvider(game);
  const found = new Map<string, Card>();

  const remember = (card: Card) => {
    for (const alias of cardAliases(card)) {
      found.set(cardNameKey(alias), card);
    }
  };

  const cached = await prisma.card.findMany({
    where: {
      game,
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
    const { cards } = await provider.getCardsByNames(missing);
    (await cacheCards(cards, game)).forEach(remember);

    const stillMissing = provider.approximateNameSearch
      ? missing.filter((name) => !found.has(cardNameKey(name)))
      : [];
    for (const name of stillMissing.slice(0, FUZZY_FALLBACK_LIMIT)) {
      await provider.wait();
      try {
        found.set(cardNameKey(name), await cacheCard(await provider.searchCardByName(name), game));
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 404)) {
          throw error;
        }
      }
    }
  }

  return { found, notFound: names.filter((name) => !found.has(cardNameKey(name))) };
}
