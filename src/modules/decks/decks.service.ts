import { Prisma, type Deck } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { cardNameKey, findOrFetchCard, resolveCardsByNames } from "../cards/cards.service";
import { Board, DECK_NAME_MAX_LENGTH, Game } from "./decks.constants";
import { deckDetailInclude, deckSummaryInclude, toDeckDetail, toDeckSummary } from "./decks.mapper";
import { ImportEntry, parseCreateDeck, parseDeckChanges } from "./decks.validation";

// Toda alteracao de cartas devolve o deck inteiro ja atualizado, assim o
// front nao precisa de um GET extra (nem de adivinhar o id interno de uma
// carta recem-adicionada).

function deckNotFound(deckId: string): HttpError {
  return new HttpError(404, `Deck com ID ${deckId} não encontrado.`, "DECK_NOT_FOUND");
}

// Nao distingue "deck inexistente" de "deck de outro usuario": ambos
// retornam 404, pra nao revelar a outro usuario que um deck existe.
async function findOwnedDeck(deckId: string, userId: string): Promise<Deck> {
  const deck = await prisma.deck.findFirst({ where: { id: deckId, userId } });
  if (!deck) {
    throw deckNotFound(deckId);
  }
  return deck;
}

// Marca o deck como editado (o @updatedAt so roda quando a propria linha do deck muda).
function touchDeck(deckId: string) {
  return prisma.deck.update({ where: { id: deckId }, data: { updatedAt: new Date() } });
}

async function findDeckEntry(deckId: string, cardId: string, board: Board) {
  const entry = await prisma.deckCard.findUnique({
    where: { deckId_cardId_board: { deckId, cardId, board } },
  });
  if (!entry) {
    throw new HttpError(404, `A carta ${cardId} não está no board '${board}' deste deck.`, "CARD_NOT_IN_DECK");
  }
  return entry;
}

export async function listUserDecks(userId: string) {
  const decks = await prisma.deck.findMany({
    where: { userId },
    include: deckSummaryInclude,
    orderBy: { createdAt: "desc" },
  });
  return decks.map(toDeckSummary);
}

export async function listPublicDecks(game?: Game) {
  return prisma.deck.findMany({
    where: {
      visibility: "public",
      ...(game ? { game } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDeck(userId: string, input: ReturnType<typeof parseCreateDeck>) {
  return prisma.deck.create({ data: { userId, ...input } });
}

// O dono ve o deck sempre; os outros (inclusive visitantes sem login), so se
// ele for publico.
export async function getDeckDetail(deckId: string, viewerId?: string) {
  const deck = await prisma.deck.findFirst({ where: { id: deckId }, include: deckDetailInclude });

  if (!deck || (deck.userId !== viewerId && deck.visibility !== "public")) {
    throw deckNotFound(deckId);
  }

  return toDeckDetail(deck, viewerId);
}

// `body` e' validado aqui, e nao na rota, porque os formatos validos dependem do jogo do deck.
export async function updateDeck(deckId: string, userId: string, body: unknown) {
  const deck = await findOwnedDeck(deckId, userId);
  const data = parseDeckChanges(body, deck.game as Game);

  if (data.coverCardId) {
    const inDeck = await prisma.deckCard.findFirst({ where: { deckId, cardId: data.coverCardId } });
    if (!inDeck) {
      throw new HttpError(400, "A capa precisa ser uma carta do deck.", "VALIDATION_ERROR");
    }
  }

  await prisma.deck.update({ where: { id: deckId }, data });
  return getDeckDetail(deckId, userId);
}

export async function deleteDeck(deckId: string, userId: string) {
  const result = await prisma.deck.deleteMany({
    where: {
      id: deckId,
      userId,
    },
  });

  if (result.count === 0) {
    throw new HttpError(404, "Deck not found.", "DECK_NOT_FOUND");
  }
}

// Copia um deck proprio ou publico de outra pessoa pra conta de `userId`.
// A copia sempre nasce privada.
export async function duplicateDeck(deckId: string, userId: string) {
  const source = await prisma.deck.findFirst({ where: { id: deckId }, include: { deckCards: true } });

  if (!source || (source.userId !== userId && source.visibility !== "public")) {
    throw deckNotFound(deckId);
  }

  const suffix = " (cópia)";
  const name = source.name.slice(0, DECK_NAME_MAX_LENGTH - suffix.length).trimEnd() + suffix;

  return prisma.deck.create({
    data: {
      userId,
      name,
      game: source.game,
      format: source.format,
      description: source.description,
      coverCardId: source.coverCardId,
      deckCards: {
        create: source.deckCards.map(({ cardId, board, quantity }) => ({ cardId, board, quantity })),
      },
    },
  });
}

export async function addCardToDeck(
  deckId: string,
  userId: string,
  { ref, quantity, board }: { ref: { externalId?: string; name?: string }; quantity: number; board: Board },
) {
  const deck = await findOwnedDeck(deckId, userId);
  const card = await findOrFetchCard(ref, deck.game);

  await prisma.$transaction([
    prisma.deckCard.upsert({
      where: { deckId_cardId_board: { deckId, cardId: card.id, board } },
      create: { deckId, cardId: card.id, board, quantity },
      update: { quantity: { increment: quantity } },
    }),
    touchDeck(deckId),
  ]);

  console.log(`${quantity}x ${card.name} adicionada(s) ao board '${board}' do deck ${deckId}.`);
  return getDeckDetail(deckId, userId);
}

async function writeQuantity(deckId: string, cardId: string, board: Board, quantity: number) {
  const where = { deckId_cardId_board: { deckId, cardId, board } };
  await prisma.$transaction([
    quantity === 0 ? prisma.deckCard.delete({ where }) : prisma.deckCard.update({ where, data: { quantity } }),
    touchDeck(deckId),
  ]);
}

// Define a quantidade exata de uma carta num board; 0 tira a carta dele.
export async function setCardQuantity(deckId: string, cardId: string, userId: string, board: Board, quantity: number) {
  await findOwnedDeck(deckId, userId);
  await findDeckEntry(deckId, cardId, board);
  await writeQuantity(deckId, cardId, board, quantity);
  return getDeckDetail(deckId, userId);
}

// Remove uma copia; na ultima, tira a carta do board.
export async function removeCardCopy(deckId: string, cardId: string, userId: string, board: Board) {
  await findOwnedDeck(deckId, userId);
  const entry = await findDeckEntry(deckId, cardId, board);
  await writeQuantity(deckId, cardId, board, entry.quantity - 1);
  return getDeckDetail(deckId, userId);
}

// Move `quantity` copias (padrao: todas) de um board pra outro, somando com
// as que ja estiverem la.
export async function moveCard(
  deckId: string,
  cardId: string,
  userId: string,
  { from, to, quantity }: { from: Board; to: Board; quantity?: number },
) {
  if (from === to) {
    throw new HttpError(400, "Os boards de origem e destino precisam ser diferentes.", "VALIDATION_ERROR");
  }

  await findOwnedDeck(deckId, userId);
  const entry = await findDeckEntry(deckId, cardId, from);
  const moving = quantity ?? entry.quantity;

  if (moving > entry.quantity) {
    throw new HttpError(400, `Só há ${entry.quantity} cópia(s) dessa carta no board '${from}'.`, "VALIDATION_ERROR");
  }

  const source = { deckId_cardId_board: { deckId, cardId, board: from } };
  await prisma.$transaction([
    moving === entry.quantity
      ? prisma.deckCard.delete({ where: source })
      : prisma.deckCard.update({ where: source, data: { quantity: { decrement: moving } } }),
    prisma.deckCard.upsert({
      where: { deckId_cardId_board: { deckId, cardId, board: to } },
      create: { deckId, cardId, board: to, quantity: moving },
      update: { quantity: { increment: moving } },
    }),
    touchDeck(deckId),
  ]);

  return getDeckDetail(deckId, userId);
}

// Importa uma lista de cartas (colada pelo usuario e ja interpretada no front).
// `replace` troca o conteudo do deck inteiro; senao, soma ao que ja existe.
export async function importCards(deckId: string, userId: string, entries: ImportEntry[], replace: boolean) {
  const deck = await findOwnedDeck(deckId, userId);

  // Um nome por carta, na grafia da primeira linha em que ela aparece.
  const uniqueNames = new Map<string, string>();
  for (const entry of entries) {
    if (!uniqueNames.has(cardNameKey(entry.name))) {
      uniqueNames.set(cardNameKey(entry.name), entry.name);
    }
  }
  const { found, notFound } = await resolveCardsByNames([...uniqueNames.values()], deck.game);

  if (found.size === 0) {
    throw new HttpError(422, "Nenhuma carta da lista foi reconhecida.", "NO_CARDS_RECOGNIZED");
  }

  // Linhas repetidas (mesma carta e board) viram uma so.
  const totals = new Map<string, { cardId: string; board: Board; quantity: number }>();
  for (const entry of entries) {
    const card = found.get(cardNameKey(entry.name));
    if (!card) {
      continue;
    }
    const key = `${card.id}:${entry.board}`;
    const current = totals.get(key);
    totals.set(key, { cardId: card.id, board: entry.board, quantity: (current?.quantity ?? 0) + entry.quantity });
  }

  // Um INSERT so pra lista inteira: um upsert por carta sao dezenas de idas ao
  // banco, e a transacao estourava o limite de 5s do Prisma num deck de 60 cartas.
  const rows = [...totals.values()].map(
    ({ cardId, board, quantity }) =>
      Prisma.sql`(${deckId}::uuid, ${cardId}::uuid, ${board}, ${quantity}::smallint)`,
  );
  await prisma.$transaction([
    ...(replace ? [prisma.deckCard.deleteMany({ where: { deckId } })] : []),
    prisma.$executeRaw`
      INSERT INTO deck_cards (deck_id, card_id, board, quantity)
      VALUES ${Prisma.join(rows)}
      ON CONFLICT (deck_id, card_id, board)
      DO UPDATE SET quantity = deck_cards.quantity + EXCLUDED.quantity`,
    touchDeck(deckId),
  ]);

  const imported = [...totals.values()].reduce((sum, entry) => sum + entry.quantity, 0);
  return { deck: await getDeckDetail(deckId, userId), imported, notFound };
}
