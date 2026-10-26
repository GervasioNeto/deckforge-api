export const GAMES = ["mtg", "pokemon"] as const;
export type Game = (typeof GAMES)[number];

export const VISIBILITIES = ["public", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

// main: deck principal; side: sideboard; maybe: cartas em avaliacao, que nao
// contam no deck; commander: zona de comandante (formato Commander).
export const BOARDS = ["main", "side", "maybe", "commander"] as const;
export type Board = (typeof BOARDS)[number];

// Formatos aceitos por jogo; null no banco = sem formato (casual).
export const FORMATS: Record<Game, readonly string[]> = {
  mtg: ["standard", "pioneer", "modern", "legacy", "vintage", "pauper", "commander"],
  pokemon: ["standard", "expanded", "unlimited"],
};

// Batem com as colunas do banco (VARCHAR(120) e o CHECK da descricao).
export const DECK_NAME_MAX_LENGTH = 120;
export const DECK_DESCRIPTION_MAX_LENGTH = 2000;

// Teto por linha (carta + board): cobre ate os 99 terrenos basicos de um
// Commander com folga, sem deixar um erro de digitacao gravar 30000 copias.
export const MAX_CARD_QUANTITY = 999;

// Um deck de Commander tem 100 cartas; 250 linhas cobre main + side + maybe.
export const IMPORT_MAX_ENTRIES = 250;
export const CARD_NAME_MAX_LENGTH = 200;
