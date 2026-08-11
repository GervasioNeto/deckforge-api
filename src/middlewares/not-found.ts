import { Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Rota nao encontrada: ${req.method} ${req.originalUrl}`,
  });
}
