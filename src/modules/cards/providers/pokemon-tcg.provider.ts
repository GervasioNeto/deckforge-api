import { env } from "../../../config/env";
import { HttpError } from "../../../middlewares/error-handler";

const POKEMON_TCG_BASE_URL = "https://api.pokemontcg.io/v2";

// A API costuma responder em menos de 1s, mas as vezes trava; sem limite a
// requisicao do nosso usuario ficaria pendurada junto.
export const POKEMON_TCG_TIMEOUT_MS = 10_000;

// Sem chave o limite e' de 30 requisicoes por minuto; com ela, so o diario.
export const POKEMON_TCG_REQUEST_GAP_MS = 100;

export const waitForPokemonTcg = () => new Promise((resolve) => setTimeout(resolve, POKEMON_TCG_REQUEST_GAP_MS));

// Maior pagina que a API aceita.
const MAX_PAGE_SIZE = 250;

// Quantos nomes vao num OR so, no import de lista.
const NAMES_PER_QUERY = 10;

// O mesmo teto de sugestoes do autocomplete da Scryfall.
const AUTOCOMPLETE_LIMIT = 20;

const POKEMON_TCG_HEADERS: Record<string, string> = env.pokemonTcgApiKey
  ? { Accept: "application/json", "X-Api-Key": env.pokemonTcgApiKey }
  : { Accept: "application/json" };

// A API anda instavel: boa parte das chamadas volta 500/502 na hora (em ~0,3s)
// e passa numa nova tentativa. Sem repetir, um import de 3 lotes quase nunca
// fechava. Timeout nao entra: cada um ja custou 10s.
export const POKEMON_TCG_ATTEMPTS = 6;
export const POKEMON_TCG_RETRY_DELAY_MS = 300;
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

type Attempt = { ok: true; data: any } | { ok: false; error: HttpError; retryable: boolean };

// Timeout ou falha de rede. O erro original vai no `cause`, pra aparecer no log.
function upstreamError(error: unknown): HttpError {
  const timedOut = error instanceof Error && error.name === "TimeoutError";
  const upstream = timedOut
    ? new HttpError(504, `A Pokémon TCG API não respondeu em ${POKEMON_TCG_TIMEOUT_MS / 1000}s.`, "UPSTREAM_ERROR")
    : new HttpError(502, "Não foi possível consultar a Pokémon TCG API.", "UPSTREAM_ERROR");
  upstream.cause = error;
  return upstream;
}

async function attemptRequest(path: string, notFoundMessage?: string): Promise<Attempt> {
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
        return { ok: false, error: new HttpError(404, notFoundMessage, "CARD_NOT_FOUND"), retryable: false };
      }
      return {
        ok: false,
        error: new HttpError(502, `Pokémon TCG API respondeu ${response.status}.`, "UPSTREAM_ERROR"),
        retryable: RETRYABLE_STATUSES.has(response.status),
      };
    }

    return { ok: true, data: await response.json() };
  } catch (error) {
    const upstream = upstreamError(error);
    // Falha de rede vale outra tentativa; timeout nao.
    return { ok: false, error: upstream, retryable: upstream.status === 502 };
  }
}

async function pokemonTcgRequest(path: string, notFoundMessage?: string) {
  for (let attempt = 1; ; attempt++) {
    const result = await attemptRequest(path, notFoundMessage);
    if (result.ok) {
      return result.data as any;
    }
    if (!result.retryable || attempt >= POKEMON_TCG_ATTEMPTS) {
      throw result.error;
    }
    // Espera um pouco mais a cada vez (0,3s, 0,6s, 0,9s...).
    await new Promise((resolve) => setTimeout(resolve, POKEMON_TCG_RETRY_DELAY_MS * attempt));
  }
}

// Por padrao, da edicao mais nova pra mais antiga: e' a impressao que entra
// quando o usuario so da o nome.
function searchPath(
  query: string,
  { orderBy = "-set.releaseDate", pageSize = MAX_PAGE_SIZE, select }: { orderBy?: string; pageSize?: number; select?: string } = {},
) {
  const params = [`q=${encodeURIComponent(query)}`, `orderBy=${orderBy}`, `pageSize=${pageSize}`];
  if (select) {
    params.push(`select=${select}`);
  }
  return `/cards?${params.join("&")}`;
}

// O `!` pede o nome exato: so `name:"Charizard"` tambem traz "Mega Charizard
// Y ex", que viria primeiro por ser mais nova. Aspas fechariam a frase antes
// da hora - nenhum nome de carta tem.
const exactName = (name: string) => `!name:"${name.replace(/"/g, "")}"`;

const nameKey = (name: string) => name.trim().toLowerCase();

export async function getPokemonCardById(externalId: string) {
  const data = await pokemonTcgRequest(
    `/cards/${encodeURIComponent(externalId)}`,
    `Carta com ID '${externalId}' não encontrada na Pokémon TCG API.`,
  );
  return data.data;
}

// A impressao mais recente com esse nome.
export async function searchPokemonCardByName(name: string) {
  const data = await pokemonTcgRequest(searchPath(exactName(name), { pageSize: 1 }));

  // Busca sem resultado nao e' 404: vem 200 com a lista vazia.
  const [card] = data.data ?? [];
  if (!card) {
    throw new HttpError(404, `Carta '${name}' não encontrada.`, "CARD_NOT_FOUND");
  }
  return card;
}

// Todas as impressoes de uma carta, da mais nova pra mais antiga (so a
// primeira pagina, ate 250).
export async function searchPokemonCardPrints(name: string): Promise<any[]> {
  const data = await pokemonTcgRequest(searchPath(exactName(name)));
  return data.data ?? [];
}

// Varias cartas pelo nome exato, 10 nomes por requisicao (um OR entre eles),
// ficando com a impressao mais recente de cada. Retorna as cartas cruas e os
// nomes que a API nao reconheceu.
export async function getPokemonCardsByNames(names: string[]): Promise<{ cards: any[]; notFound: string[] }> {
  const newest = new Map<string, any>();
  const pushedOut: string[] = [];

  for (let start = 0; start < names.length; start += NAMES_PER_QUERY) {
    if (start > 0) {
      await waitForPokemonTcg();
    }

    const batch = names.slice(start, start + NAMES_PER_QUERY);
    const data = await pokemonTcgRequest(searchPath(batch.map(exactName).join(" OR ")));
    const page: any[] = data.data ?? [];

    // Ja vem da mais nova pra mais antiga: a primeira de cada nome fica.
    for (const card of page) {
      if (!newest.has(nameKey(card.name))) {
        newest.set(nameKey(card.name), card);
      }
    }

    // Pagina cheia: um nome com muitas impressoes pode ter empurrado todas as
    // de outro pra pagina seguinte. Esses vao um a um.
    if (data.totalCount > page.length) {
      pushedOut.push(...batch.filter((name) => !newest.has(nameKey(name))));
    }
  }

  for (const name of pushedOut) {
    await waitForPokemonTcg();
    try {
      const card = await searchPokemonCardByName(name);
      newest.set(nameKey(card.name), card);
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 404)) {
        throw error;
      }
    }
  }

  return { cards: [...newest.values()], notFound: names.filter((name) => !newest.has(nameKey(name))) };
}

// A API nao tem autocomplete: cada palavra digitada vira um prefixo
// ("mega char" -> name:mega* name:char*). A pontuacao sai porque e' sintaxe
// da busca, e a API ja quebra o nome nela ("porygon-z" casa com porygon* z*).
export async function autocompletePokemonCardNames(query: string): Promise<string[]> {
  const words = query.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  if (words.length === 0) {
    return [];
  }

  const data = await pokemonTcgRequest(
    searchPath(words.map((word) => `name:${word}*`).join(" "), { orderBy: "name", select: "name" }),
  );
  const names = [...new Set<string>((data.data ?? []).map((card: any) => card.name))];

  // Quem comeca com o texto digitado vem antes ("char": Charizard antes de Big Charm).
  const typed = query.trim().toLowerCase();
  const startsWithTyped = (name: string) => name.toLowerCase().startsWith(typed);
  return [...names.filter(startsWithTyped), ...names.filter((name) => !startsWithTyped(name))].slice(
    0,
    AUTOCOMPLETE_LIMIT,
  );
}
