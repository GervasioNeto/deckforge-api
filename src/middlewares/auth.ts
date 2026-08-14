import { NextFunction, Request, Response } from "express";
import { supabase } from "../config/supabase";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Token ausente" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  // getUser manda o token pra Supabase validar (assinatura + se a sessao
  // ainda esta ativa) - por isso precisa de rede, diferente de decodificar
  // o JWT localmente.
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Token invalido ou expirado" });
    return;
  }

  req.user = { id: data.user.id, email: data.user.email ?? "" };
  next();
}
