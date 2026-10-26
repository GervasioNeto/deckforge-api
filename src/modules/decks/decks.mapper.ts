import type { Prisma } from "@prisma/client";
import { mapScryfallCard } from "../cards/providers/scryfall.provider";

// Formato das respostas de deck. As rotas nunca devolvem `rawData` (a
// resposta inteira da Scryfall, varios KB por carta): so os campos mapeados.

export const deckDetailInclude = {
  user: { select: { id: true, name: true } },
  deckCards: {
    include: { card: true },
    orderBy: { card: { name: "asc" } },
  },
} satisfies Prisma.DeckInclude;

export type DeckWithCards = Prisma.DeckGetPayload<{ include: typeof deckDetailInclude }>;

// O minimo pra contar cartas e escolher a capa, sem carregar o rawData.
export const deckSummaryInclude = {
  coverCard: { select: { imageUrl: true } },
  deckCards: { select: { quantity: true, board: true, card: { select: { imageUrl: true } } } },
} satisfies Prisma.DeckInclude;

export type DeckWithSummary = Prisma.DeckGetPayload<{ include: typeof deckSummaryInclude }>;

// So main e comandante contam como "o deck"; side e maybe ficam de fora.
const COUNTED_BOARDS = new Set(["main", "commander"]);

interface CoverCandidate {
  board: string;
  quantity: number;
  imageUrl: string | null;
}

// A capa escolhida pelo dono; sem ela, o comandante ou a carta com mais copias.
function pickCoverImage(cards: CoverCandidate[], chosen: string | null | undefined): string | null {
  if (chosen) {
    return chosen;
  }

  let best: CoverCandidate | null = null;
  for (const card of cards) {
    if (!card.imageUrl || !COUNTED_BOARDS.has(card.board)) {
      continue;
    }
    const isCommander = card.board === "commander";
    const bestIsCommander = best?.board === "commander";
    if (!best || (isCommander && !bestIsCommander) || (isCommander === bestIsCommander && card.quantity > best.quantity)) {
      best = card;
    }
  }
  return best?.imageUrl ?? null;
}

function countCards(cards: { board: string; quantity: number }[]): number {
  return cards.reduce((sum, card) => (COUNTED_BOARDS.has(card.board) ? sum + card.quantity : sum), 0);
}

export function toDeckCard(deckCard: DeckWithCards["deckCards"][number]) {
  const { card } = deckCard;
  const rawData = typeof card.rawData === "object" && card.rawData !== null ? card.rawData : {};
  const mapped = mapScryfallCard({ id: card.externalId, name: card.name, ...rawData });

  return {
    ...mapped,
    // `id` e' o nosso id interno (o das rotas /decks/:deckId/cards/:cardId);
    // o da Scryfall vai em `externalId`.
    id: card.id,
    externalId: card.externalId,
    // Cartas antigas no cache podem ter image_url "" (duas faces).
    imageUrl: mapped.imageUrl ?? (card.imageUrl || null),
    board: deckCard.board,
    quantity: deckCard.quantity,
  };
}

export type DeckCardResponse = ReturnType<typeof toDeckCard>;

export function toDeckDetail(deck: DeckWithCards, viewerId?: string) {
  const isOwner = !!viewerId && deck.userId === viewerId;
  const cards = deck.deckCards.map(toDeckCard);
  const chosenCover = cards.find((card) => card.id === deck.coverCardId)?.imageUrl;

  return {
    id: deck.id,
    name: deck.name,
    game: deck.game,
    format: deck.format ?? null,
    description: deck.description ?? null,
    visibility: deck.visibility,
    coverCardId: deck.coverCardId ?? null,
    coverImageUrl: pickCoverImage(cards, chosenCover),
    // O link de compartilhamento e' coisa do dono.
    ...(isOwner ? { shareToken: deck.shareToken } : {}),
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    isOwner,
    author: deck.user ? { id: deck.user.id, name: deck.user.name } : null,
    cardCount: countCards(cards),
    cards,
  };
}

export type DeckDetailResponse = ReturnType<typeof toDeckDetail>;

export function toDeckSummary(deck: DeckWithSummary) {
  const { deckCards, coverCard, ...fields } = deck;
  const candidates = deckCards.map((deckCard) => ({
    board: deckCard.board,
    quantity: deckCard.quantity,
    imageUrl: deckCard.card.imageUrl || null,
  }));

  return {
    ...fields,
    cardCount: countCards(candidates),
    coverImageUrl: pickCoverImage(candidates, coverCard?.imageUrl || null),
  };
}
