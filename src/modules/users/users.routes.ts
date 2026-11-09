import { Router } from "express";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import { publicName } from "../../utils/public-name";
import { isValidUuid } from "../../utils/validators";
import { deckSummaryInclude, toPublicDeckSummary } from "../decks/decks.mapper";

const USER_NAME_MAX_LENGTH = 60;
const USER_SEARCH_MIN_LENGTH = 2;
const USER_SEARCH_LIMIT = 20;

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

usersRoutes.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (name === "" || name.length > USER_NAME_MAX_LENGTH) {
      throw new HttpError(400, `O nome deve ter entre 1 e ${USER_NAME_MAX_LENGTH} caracteres.`, "VALIDATION_ERROR");
    }

    const profile = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!profile) {
      throw new HttpError(404, "Perfil nao encontrado", "NOT_FOUND");
    }

    res.json(await prisma.user.update({ where: { id: profile.id }, data: { name, updatedAt: new Date() } }));
  } catch (error) {
    next(error);
  }
});

// Antes de /users/:userId, senao "search" cairia como um userId. Publica e
// sem email, como o perfil publico.
usersRoutes.get("/users/search", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (q.length < USER_SEARCH_MIN_LENGTH) {
      res.json({ users: [] });
      return;
    }

    const users = await prisma.user.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { decks: { where: { visibility: "public" } } } },
      },
      orderBy: { name: "asc" },
      take: USER_SEARCH_LIMIT,
    });

    res.json({ users: users.map(({ _count, ...user }) => ({ ...user, publicDeckCount: _count.decks })) });
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
      include: deckSummaryInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ ...profile, name: publicName(profile.name), decks: decks.map(toPublicDeckSummary) });
  } catch (error) {
    next(error);
  }
});
