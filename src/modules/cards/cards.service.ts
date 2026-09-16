import { prisma } from "../../config/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { getCardById, mapScryfallCard, searchCardByName } from "./providers/scryfall.provider";

// So trata MTG por enquanto - quando entrar Pokemon, isso precisa
// receber um `game` e escolher o provider/mapper certo.
export async function getCardByName(name: string) {

    const normalizedName = name.trim().replace(/\+/g, " ");
    const cached = await prisma.card.findFirst({
        where: {
        name: { equals: normalizedName, mode: "insensitive" },
        game: "mtg",
        },
    });

  if (cached) {
    console.log(`Carta ${normalizedName} encontrada no cache.`);
    return mapScryfallCard(cached.rawData);
  }

  const raw = await searchCardByName(name);
  console.log(`Carta ${normalizedName} não encontrada no cache. Buscando na Scryfall...`);

await prisma.card.upsert({
  where: { externalId_game: { externalId: raw.id, game: "mtg" } },
  create: { externalId: raw.id, game: "mtg", name: raw.name, imageUrl: raw.image_uris?.normal ?? "", text: raw.oracle_text ?? null, rawData: raw },
  update: {},
});

  return mapScryfallCard(raw);
}

export async function getOrCreateCardByExternalId(externalId: string, game: string) {

    const cached = await prisma.card.findUnique({ where: { externalId_game: { externalId, game } } });

  if (cached) {
    console.log(`Carta de ID ${externalId} encontrada no cache.`);
    return { ...mapScryfallCard(cached.rawData), id: cached.id };
  }

  const raw = await getCardById(externalId);
  console.log(`Carta de ID ${externalId} não encontrada no cache. Buscando na Scryfall...`);

  const saved = await prisma.card.upsert({
    where: { externalId_game: { externalId: raw.id, game } },
    create: { externalId: raw.id, game, name: raw.name, imageUrl: raw.image_uris?.normal ?? "", text: raw.oracle_text ?? null, rawData: raw },
    update: {},
  });

  return { ...mapScryfallCard(raw), id: saved.id };
}

// Busca a carta pelo nosso id interno (uuid), so no banco local - nunca bate
// na API externa. O `game` vem do deck: garante que a carta pertence ao mesmo
// jogo do deck que esta sendo modificado.
export async function getCardByInternalId(cardId: string, game: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cardId);

  if (!isUuid) {
    throw new HttpError(400, `'${cardId}' não é um ID de carta válido.`);
  }

  const card = await prisma.card.findUnique({ where: { id: cardId } });

  if (!card || card.game !== game) {
    throw new HttpError(404, `Carta com ID ${cardId} não encontrada.`);
  }

  return { ...mapScryfallCard(card.rawData), id: card.id };
}

export async function addCardToDeck(deckId: string, cardExternalId: string, userId: string) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId } });

  if (!deck) {
    throw new HttpError(404, `Deck com ID ${deckId} não encontrado.`);
  }

  if (deck.userId !== userId) {
    throw new HttpError(403, `Usuário ${userId} não tem permissão para modificar o deck ${deckId}.`);
  }

  const card = await getOrCreateCardByExternalId(cardExternalId, deck.game);

  await prisma.deckCard.upsert({
    where: { deckId_cardId: { deckId, cardId: card.id } },
    create: { deckId, cardId: card.id },
    update: { quantity: { increment: 1 } },
  });

  console.log(`Carta ${card.name} adicionada ao deck ${deckId}.`);
}

export async function removeCardFromDeck(deckId: string, cardId: string, userId: string) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId } });

  if (!deck) {
    throw new HttpError(404, `Deck com ID ${deckId} não encontrado.`);
  }

  if (deck.userId !== userId) {
    throw new HttpError(403, `Usuário ${userId} não tem permissão para modificar o deck ${deckId}.`);
  }

  const card = await getCardByInternalId(cardId, deck.game);

  const deckCard = await prisma.deckCard.findUnique({
    where: { deckId_cardId: { deckId, cardId: card.id } },
  });

  if (!deckCard) {
    throw new HttpError(404, `Carta ${card.name} não está no deck ${deckId}.`);
  }

  if (deckCard.quantity > 1) {
    await prisma.deckCard.update({
      where: { deckId_cardId: { deckId, cardId: card.id } },
      data: { quantity: { decrement: 1 } },
    });
  } else {
    await prisma.deckCard.delete({
      where: { deckId_cardId: { deckId, cardId: card.id } },
    });
  }

  console.log(`Carta ${card.name} removida do deck ${deckId}.`);
}