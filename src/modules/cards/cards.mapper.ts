import type { Game } from "../decks/decks.constants";
import { mapPokemonCard } from "./providers/pokemon-tcg.mapper";
import { mapScryfallCard } from "./providers/scryfall.provider";

// Como ler a carta crua de cada jogo. Fica fora do cards.providers.ts porque
// nao faz requisicao nenhuma: o decks.mapper usa isso sem carregar o env.
const GAME_MAPPERS = {
  mtg: {
    mapCard: mapScryfallCard,
    text: (raw: any): string | null => raw.oracle_text ?? null,
  },
  pokemon: {
    mapCard: mapPokemonCard,
    // Treinadores e Energias tem todo o texto nas regras.
    text: (raw: any): string | null => (Array.isArray(raw.rules) ? raw.rules.join("\n") : "") || null,
  },
} satisfies Record<Game, { mapCard: (raw: any) => unknown; text: (raw: any) => string | null }>;

export type MappedCard = ReturnType<(typeof GAME_MAPPERS)[Game]["mapCard"]>;

function mapperFor(game: string) {
  // hasOwn, e nao `in`: "toString" e companhia nao sao jogos.
  if (!Object.hasOwn(GAME_MAPPERS, game)) {
    throw new Error(`Nenhum mapper de cartas para o jogo '${game}'.`);
  }
  return GAME_MAPPERS[game as Game];
}

export function mapCard(game: string, raw: any): MappedCard {
  return mapperFor(game).mapCard(raw);
}

// Texto gravado na coluna `text` do cache.
export function cardText(game: string, raw: any): string | null {
  return mapperFor(game).text(raw);
}

// Uma impressao na lista de GET /cards/search: o suficiente pra escolher a arte
// e, no Pokemon, saber se ela vale no Standard (que segue a marca de regulacao).
export function toCardPrint(game: string, raw: any) {
  const card = mapCard(game, raw);
  return {
    externalId: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
    setName: card.setName,
    collectorNumber: card.collectorNumber,
    regulationMark: "regulationMark" in card ? card.regulationMark : null,
  };
}

export type CardPrint = ReturnType<typeof toCardPrint>;
