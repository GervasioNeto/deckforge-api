import { Router } from "express";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import { isValidUuid } from "../../utils/validators";

export const usersRoutes = Router();

usersRoutes.get("/me", requireAuth, async (req, res, next) => {
  try {
    const profile = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!profile) {
      throw new HttpError(404, "Perfil nao encontrado", "NOT_FOUND");
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// Perfil publico: nao exige auth e nunca expoe email (diferente de /me) -
// so o que faz sentido mostrar pra qualquer visitante, mais os decks
// publicos do usuario (nunca os privados, mesmo sendo o dono do perfil
// quem esta olhando).
usersRoutes.get("/users/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!isValidUuid(userId)) {
      throw new HttpError(400, `'${userId}' não é um ID de usuário válido.`, "INVALID_USER_ID");
    }

    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, createdAt: true },
    });

    if (!profile) {
      throw new HttpError(404, `Usuário com ID ${userId} não encontrado.`, "USER_NOT_FOUND");
    }

    const decks = await prisma.deck.findMany({
      where: { userId, visibility: "public" },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ...profile, decks });
  } catch (error) {
    next(error);
  }
});
