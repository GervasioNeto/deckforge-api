/**
 * Smoke test: chama todas as rotas da API (sucesso + erro) contra o servidor
 * real (Postgres/Supabase/Scryfall de verdade) e imprime uma tabela com o
 * status esperado x o status obtido. Uso: `npm run smoke-test` com o
 * servidor já rodando (`npm run dev`).
 */
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";

const BASE_URL = `http://localhost:${env.port}/api`;
const TEST_EMAIL = "teste.deckforge@yopmail.com";
const TEST_PASSWORD = "Teste@123";
const BLACK_LOTUS_EXTERNAL_ID = "bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd";

type Result = {
  rota: string;
  metodo: string;
  esperado: number;
  real: number | string;
  ok: boolean;
  obs?: string;
};

const results: Result[] = [];

async function call(
  rota: string,
  metodo: string,
  path: string,
  esperado: number,
  opts: { token?: string; body?: unknown } = {},
): Promise<any> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: metodo,
      headers: {
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const ok = res.status === esperado;
    let json: any = null;
    try {
      json = await res.clone().json();
    } catch {
      // resposta sem corpo (204), ignora
    }

    results.push({
      rota,
      metodo,
      esperado,
      real: res.status,
      ok,
      obs: ok ? undefined : JSON.stringify(json),
    });

    return json;
  } catch (error) {
    results.push({
      rota,
      metodo,
      esperado,
      real: "ERR",
      ok: false,
      obs: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.supabaseAnonKey },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const json = await res.json();

  results.push({
    rota: "Supabase login (setup, não é rota da API)",
    metodo: "POST",
    esperado: 200,
    real: res.status,
    ok: res.status === 200,
    obs: res.status === 200 ? undefined : JSON.stringify(json),
  });

  if (!json.access_token) {
    throw new Error(
      `Não consegui logar com o usuário de teste (${TEST_EMAIL}). Rode o signup primeiro ou ajuste TEST_EMAIL/TEST_PASSWORD no script.`,
    );
  }

  return json.access_token;
}

async function main() {
  // servidor de pé?
  try {
    await fetch(`${BASE_URL}/health`);
  } catch {
    console.error(`\n❌ Não consegui conectar em ${BASE_URL}. Rode 'npm run dev' antes do smoke test.\n`);
    process.exit(1);
  }

  await call("GET /health", "GET", "/health", 200);

  await call("GET /cards?name=... (sucesso)", "GET", "/cards?name=Black%20Lotus", 200);
  await call("GET /cards sem name", "GET", "/cards", 400);

  const token = await login();

  await call("GET /me sem token", "GET", "/me", 401);
  await call("GET /me com token inválido", "GET", "/me", 401, { token: "token-invalido" });
  await call("GET /me (sucesso)", "GET", "/me", 200, { token });

  await call("POST /decks sem token", "POST", "/decks", 401, { body: { name: "x", game: "mtg" } });
  await call("POST /decks com game inválido", "POST", "/decks", 400, {
    token,
    body: { name: "x", game: "yugioh" },
  });
  await call("POST /decks sem name", "POST", "/decks", 400, { token, body: { game: "mtg" } });

  const deck = await call("POST /decks (sucesso)", "POST", "/decks", 201, {
    token,
    body: { name: "Smoke Test Deck", game: "mtg", visibility: "public" },
  });
  const deckId = deck?.id;

  await call("GET /decks (sucesso)", "GET", "/decks", 200, { token });

  await call("POST /decks/:deckId/cards com deckId inválido", "POST", "/decks/nao-uuid/cards", 400, {
    token,
    body: { externalId: BLACK_LOTUS_EXTERNAL_ID },
  });
  await call(
    "POST /decks/:deckId/cards em deck inexistente",
    "POST",
    "/decks/11111111-1111-1111-1111-111111111111/cards",
    404,
    { token, body: { externalId: BLACK_LOTUS_EXTERNAL_ID } },
  );
  await call("POST /decks/:deckId/cards (sucesso)", "POST", `/decks/${deckId}/cards`, 204, {
    token,
    body: { externalId: BLACK_LOTUS_EXTERNAL_ID },
  });

  await call(
    "DELETE /decks/:deckId/cards/:cardId inexistente",
    "DELETE",
    `/decks/${deckId}/cards/00000000-0000-0000-0000-000000000000`,
    404,
    { token },
  );

  // cardId aqui é o id INTERNO da tabela `cards` (gap conhecido: nenhuma
  // rota da API expõe esse id hoje, então buscamos direto no banco).
  const card = await prisma.card.findUnique({
    where: { externalId_game: { externalId: BLACK_LOTUS_EXTERNAL_ID, game: "mtg" } },
  });
  await call(
    "DELETE /decks/:deckId/cards/:cardId (sucesso)",
    "DELETE",
    `/decks/${deckId}/cards/${card?.id}`,
    204,
    { token },
  );

  await call("DELETE /decks/:deckId sem token", "DELETE", `/decks/${deckId}`, 401);
  await call("DELETE /decks/:deckId (sucesso)", "DELETE", `/decks/${deckId}`, 204, { token });
  await call("DELETE /decks/:deckId já deletado", "DELETE", `/decks/${deckId}`, 404, { token });

  await call("GET rota inexistente", "GET", "/rota-que-nao-existe", 404);

  await prisma.$disconnect();

  console.log("");
  console.table(
    results.map((r) => ({
      Rota: r.rota,
      Método: r.metodo,
      Esperado: r.esperado,
      Real: r.real,
      Resultado: r.ok ? "✅" : "❌",
      Obs: r.obs ?? "",
    })),
  );

  const falhas = results.filter((r) => !r.ok);
  console.log(`\n${results.length - falhas.length}/${results.length} passaram.`);

  if (falhas.length > 0) {
    console.log(`\n❌ ${falhas.length} falha(s):`);
    for (const f of falhas) {
      console.log(`  - ${f.rota}: esperado ${f.esperado}, veio ${f.real}${f.obs ? ` (${f.obs})` : ""}`);
    }
    process.exitCode = 1;
  } else {
    console.log("\n✅ Todas as rotas responderam como esperado.");
  }
}

main();
