import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: required("NODE_ENV", "development"),
  port: Number(required("PORT", "3333")),
  databaseUrl: required("DATABASE_URL"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  // Opcional: sem chave a Pokemon TCG API responde igual, so com limite de
  // requisicoes menor. `||` porque o .env.example traz a variavel vazia.
  pokemonTcgApiKey: process.env.POKEMON_TCG_API_KEY || undefined,
};
