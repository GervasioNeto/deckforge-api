import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// A aplicacao usa a conexao com pooling (DATABASE_URL) em runtime, diferente
// do CLI do Prisma (prisma.config.ts), que usa a conexao direta (DIRECT_URL)
// para rodar migrations.
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

// Uma unica instancia reaproveitada pela aplicacao inteira, em vez de abrir
// uma conexao nova a cada query.
export const prisma = new PrismaClient({ adapter });
