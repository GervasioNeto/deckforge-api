import { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.name, message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Erro interno do servidor" });
}
