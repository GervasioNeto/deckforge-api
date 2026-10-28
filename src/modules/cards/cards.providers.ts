import type { Game } from "../decks/decks.constants";
import {
  autocompletePokemonCardNames,
  getPokemonCardById,
  getPokemonCardsByNames,
  searchPokemonCardByName,
  searchPokemonCardPrints,
  waitForPokemonTcg,
} from "./providers/pokemon-tcg.provider";
import {
  autocompleteCardNames,
  getCardById,
  getCardsByNames,
  searchCardByName,
  searchCardPrints,
  waitForScryfall,
} from "./providers/scryfall.provider";

// O que o cards.service precisa da API externa de cada jogo. Tudo devolve as
// cartas cruas, como a API mandou: e' isso que vai pro raw_data do cache.
export interface CardProvider {
  // Pros logs ("Buscando na Scryfall...").
  name: string;
  getCardById(externalId: string): Promise<any>;
  // A carta que melhor bate com o nome: busca aproximada na Scryfall, nome
  // exato (impressao mais recente) na Pokemon TCG API.
  searchCardByName(name: string): Promise<any>;
  // So com busca aproximada vale tentar de novo, um a um, os nomes que o
  // lote exato nao achou - e' o que pega erro de digitacao no import.
  approximateNameSearch: boolean;
  // Varias cartas pelo nome exato, com o minimo de requisicoes.
  getCardsByNames(names: string[]): Promise<{ cards: any[]; notFound: string[] }>;
  autocompleteCardNames(query: string): Promise<string[]>;
  // Todas as impressoes de uma carta (nome exato), da mais nova pra mais antiga.
  searchCardPrints(name: string): Promise<any[]>;
  // Pausa entre requisicoes em sequencia, pra respeitar o limite da API.
  wait(): Promise<unknown>;
}

const CARD_PROVIDERS: Record<Game, CardProvider> = {
  mtg: {
    name: "Scryfall",
    getCardById,
    searchCardByName,
    approximateNameSearch: true,
    getCardsByNames,
    autocompleteCardNames,
    searchCardPrints,
    wait: waitForScryfall,
  },
  pokemon: {
    name: "Pokémon TCG API",
    getCardById: getPokemonCardById,
    searchCardByName: searchPokemonCardByName,
    approximateNameSearch: false,
    getCardsByNames: getPokemonCardsByNames,
    autocompleteCardNames: autocompletePokemonCardNames,
    searchCardPrints: searchPokemonCardPrints,
    wait: waitForPokemonTcg,
  },
};

// Os jogos sao validados na entrada (parseGame); um jogo desconhecido aqui e' bug.
export function getCardProvider(game: string): CardProvider {
  if (!Object.hasOwn(CARD_PROVIDERS, game)) {
    throw new Error(`Nenhum provider de cartas para o jogo '${game}'.`);
  }
  return CARD_PROVIDERS[game as Game];
}
