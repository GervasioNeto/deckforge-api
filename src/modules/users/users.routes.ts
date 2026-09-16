import { Router } from "express";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";

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
