import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Cliente usado so pra verificar tokens de usuario (auth.getUser). Nao
// serve pra ler/escrever tabelas - isso e' sempre via Prisma.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
