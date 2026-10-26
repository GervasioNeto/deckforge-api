import { HttpError } from "../../middlewares/error-handler";
import { isValidUuid } from "../../utils/validators";
import {
  BOARDS,
  Board,
  CARD_NAME_MAX_LENGTH,
  DECK_DESCRIPTION_MAX_LENGTH,
  DECK_NAME_MAX_LENGTH,
  FORMATS,
  GAMES,
  Game,
  IMPORT_MAX_ENTRIES,
  MAX_CARD_QUANTITY,
  VISIBILITIES,
  Visibility,
} from "./decks.constants";

// Validacao dos corpos/params das rotas de decks. Tudo aqui lanca
// HttpError 400, que o error-handler devolve como { error, message }.

function invalid(message: string, code = "VALIDATION_ERROR"): never {
  throw new HttpError(400, message, code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertDeckId(deckId: string): void {
  if (!isValidUuid(deckId)) {
    invalid(`'${deckId}' não é um ID de deck válido.`, "INVALID_DECK_ID");
  }
}

export function assertCardId(cardId: string): void {
  if (!isValidUuid(cardId)) {
    invalid(`'${cardId}' não é um ID de carta válido.`, "INVALID_CARD_ID");
  }
}

export function parseGame(value: unknown): Game {
  if (typeof value !== "string" || !(GAMES as readonly string[]).includes(value)) {
    invalid("O campo 'game' deve ser 'mtg' ou 'pokemon'.");
  }
  return value as Game;
}

export function parseVisibility(value: unknown): Visibility {
  if (typeof value !== "string" || !(VISIBILITIES as readonly string[]).includes(value)) {
    invalid("O campo 'visibility' deve ser 'public' ou 'private'.");
  }
  return value as Visibility;
}

export function parseBoard(value: unknown, field = "board"): Board {
  if (value === undefined) {
    return "main";
  }
  if (typeof value !== "string" || !(BOARDS as readonly string[]).includes(value)) {
    invalid(`O campo '${field}' deve ser um destes: ${BOARDS.join(", ")}.`);
  }
  return value as Board;
}

export function parseQuantity(value: unknown, { min = 1, fallback }: { min?: number; fallback?: number } = {}): number {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > MAX_CARD_QUANTITY) {
    invalid(`O campo 'quantity' deve ser um inteiro entre ${min} e ${MAX_CARD_QUANTITY}.`);
  }
  return value;
}

export function parseDeckName(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    invalid("O campo 'name' é obrigatório.");
  }
  const name = value.trim();
  if (name.length > DECK_NAME_MAX_LENGTH) {
    invalid(`O nome do deck pode ter no máximo ${DECK_NAME_MAX_LENGTH} caracteres.`);
  }
  return name;
}

export function parseFormat(value: unknown, game: Game): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string" || !FORMATS[game].includes(value)) {
    invalid(`Formato inválido para ${game}. Use um destes: ${FORMATS[game].join(", ")}.`);
  }
  return value;
}

export function parseDescription(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    invalid("O campo 'description' deve ser um texto.");
  }
  const description = value.trim();
  if (description.length > DECK_DESCRIPTION_MAX_LENGTH) {
    invalid(`A descrição pode ter no máximo ${DECK_DESCRIPTION_MAX_LENGTH} caracteres.`);
  }
  return description || null;
}

export function parseCreateDeck(body: unknown) {
  const data = isPlainObject(body) ? body : {};
  const game = parseGame(data.game);

  return {
    name: parseDeckName(data.name),
    game,
    format: parseFormat(data.format, game),
    description: parseDescription(data.description),
    ...(data.visibility !== undefined ? { visibility: parseVisibility(data.visibility) } : {}),
  };
}

export interface DeckChanges {
  name?: string;
  visibility?: Visibility;
  format?: string | null;
  description?: string | null;
  coverCardId?: string | null;
}

// Atualizacao parcial: so os campos presentes no corpo mudam.
export function parseDeckChanges(body: unknown, game: Game): DeckChanges {
  if (!isPlainObject(body)) {
    invalid("O corpo da requisição deve ser um objeto.");
  }

  const changes: DeckChanges = {};
  if ("name" in body) changes.name = parseDeckName(body.name);
  if ("visibility" in body) changes.visibility = parseVisibility(body.visibility);
  if ("format" in body) changes.format = parseFormat(body.format, game);
  if ("description" in body) changes.description = parseDescription(body.description);
  if ("coverCardId" in body) {
    if (body.coverCardId !== null) {
      assertCardId(String(body.coverCardId));
    }
    changes.coverCardId = body.coverCardId as string | null;
  }

  if (Object.keys(changes).length === 0) {
    invalid("Informe ao menos um campo para atualizar: name, visibility, format, description ou coverCardId.");
  }
  return changes;
}

// Carta a adicionar: pelo id externo (de uma busca) ou direto pelo nome.
export function parseAddCard(body: unknown) {
  const data = isPlainObject(body) ? body : {};
  const { externalId, name } = data;

  const hasExternalId = typeof externalId === "string" && externalId.trim() !== "";
  const hasName = typeof name === "string" && name.trim() !== "";
  if (!hasExternalId && !hasName) {
    invalid("Informe 'externalId' ou 'name' da carta.");
  }

  return {
    ref: hasExternalId ? { externalId: (externalId as string).trim() } : { name: (name as string).trim() },
    quantity: parseQuantity(data.quantity, { fallback: 1 }),
    board: parseBoard(data.board),
  };
}

export interface ImportEntry {
  name: string;
  quantity: number;
  board: Board;
}

export function parseImport(body: unknown): { entries: ImportEntry[]; replace: boolean } {
  const data = isPlainObject(body) ? body : {};
  const { entries } = data;

  if (!Array.isArray(entries) || entries.length === 0) {
    invalid("O campo 'entries' deve ser uma lista com ao menos uma carta.");
  }
  if (entries.length > IMPORT_MAX_ENTRIES) {
    invalid(`A lista pode ter no máximo ${IMPORT_MAX_ENTRIES} linhas.`);
  }

  const parsed = entries.map((entry, index) => {
    if (!isPlainObject(entry) || typeof entry.name !== "string" || entry.name.trim() === "") {
      invalid(`Linha ${index + 1}: 'name' é obrigatório.`);
    }
    const name = entry.name.trim();
    if (name.length > CARD_NAME_MAX_LENGTH) {
      invalid(`Linha ${index + 1}: nome de carta muito longo.`);
    }
    return { name, quantity: parseQuantity(entry.quantity, { fallback: 1 }), board: parseBoard(entry.board) };
  });

  return { entries: parsed, replace: data.replace === true };
}
