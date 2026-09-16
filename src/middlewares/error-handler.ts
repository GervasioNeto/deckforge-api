import { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

function isBodyParserSyntaxError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    (err as { status?: number }).status === 400 &&
    (err as { type?: string }).type === "entity.parse.failed"
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }

  if (isBodyParserSyntaxError(err)) {
    res.status(400).json({ error: "INVALID_JSON", message: "Corpo da requisição não é um JSON válido." });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Erro interno do servidor" });
}
