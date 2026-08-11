import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // O Prisma Migrate/CLI precisa da conexao direta (nao-pooled) do
    // Supabase para rodar DDL (CREATE TABLE etc). A aplicacao em runtime
    // usa a conexao com pooling (DATABASE_URL) - veja src/config/prisma.ts.
    url: env("DIRECT_URL"),
  },
});
