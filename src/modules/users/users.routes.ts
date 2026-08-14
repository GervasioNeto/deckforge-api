import { Router } from "express";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middlewares/auth";

export const usersRoutes = Router();

usersRoutes.get("/me", requireAuth, async (req, res) => {
  const profile = await prisma.user.findUnique({ where: { id: req.user!.id } });

  if (!profile) {
    res.status(404).json({ error: "NOT_FOUND", message: "Perfil nao encontrado" });
    return;
  }

  res.json(profile);
});
