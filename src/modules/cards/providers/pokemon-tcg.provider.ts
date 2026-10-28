import { env } from "../../../config/env";
import { HttpError } from "../../../middlewares/error-handler";

const POKEMON_TCG_BASE_URL = "https://api.pokemontcg.io/v2";

// A API costuma responder em menos de 1s, mas as vezes trava; sem limite a
// requisicao do nosso usuario ficaria pendurada junto.
export const POKEMON_TCG_TIMEOUT_MS = 10_000;

const POKEMON_TCG_HEADERS: Record<string, string> = env.pokemonTcgApiKey
  ? { Accept: "application/json", "X-Api-Key": env.pokemonTcgApiKey }
  : { Accept: "application/json" };

// Timeout ou falha de rede. O erro original vai no `cause`, pra aparecer no log.
function upstreamError(error: unknown): HttpError {
  const timedOut = error instanceof Error && error.name === "TimeoutError";
  const upstream = timedOut
    ? new HttpError(504, `A Pokémon TCG API não respondeu em ${POKEMON_TCG_TIMEOUT_MS / 1000}s.`, "UPSTREAM_ERROR")
    : new HttpError(502, "Não foi possível consultar a Pokémon TCG API.", "UPSTREAM_ERROR");
  upstream.cause = error;
  return upstream;
}

async function pokemonTcgRequest(path: string, notFoundMessage?: string) {
  try {
    // O timeout vale ate o corpo terminar de chegar, nao so os headers.
    const response = await fetch(`${POKEMON_TCG_BASE_URL}${path}`, {
      headers: POKEMON_TCG_HEADERS,
      signal: AbortSignal.timeout(POKEMON_TCG_TIMEOUT_MS),
    });

    // O status e' conferido antes de ler o corpo: os erros do proxy na frente
    // da API chegam em HTML ou texto puro ("error code: 502"), nao em JSON.
    if (!response.ok) {
      if (response.status === 404 && notFoundMessage) {
        throw new HttpError(404, notFoundMessage, "CARD_NOT_FOUND");
      }
      throw new HttpError(502, `Pokémon TCG API respondeu ${response.status}.`, "UPSTREAM_ERROR");
    }

    return (await response.json()) as any;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw upstreamError(error);
  }
}

export async function getPokemonCardById(externalId: string) {
  const data = await pokemonTcgRequest(
    `/cards/${encodeURIComponent(externalId)}`,
    `Carta com ID '${externalId}' não encontrada na Pokémon TCG API.`,
  );
  return data.data;
}

// O `!` pede o nome exato: so `name:"Charizard"` tambem traz "Mega Charizard
// Y ex", que viria primeiro por ser mais nova. Entre as impressoes com esse
// nome, fica a da edicao mais recente.
export async function searchPokemonCardByName(name: string) {
  // Aspas fechariam a frase antes da hora - nenhum nome de carta tem.
  const query = `!name:"${name.replace(/"/g, "")}"`;
  const data = await pokemonTcgRequest(`/cards?q=${encodeURIComponent(query)}&orderBy=-set.releaseDate&pageSize=1`);

  // Busca sem resultado nao e' 404: vem 200 com a lista vazia.
  const [card] = data.data ?? [];
  if (!card) {
    throw new HttpError(404, `Carta '${name}' não encontrada.`, "CARD_NOT_FOUND");
  }
  return card;
}
