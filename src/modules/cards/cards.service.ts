import { prisma } from "../../config/prisma";
import { mapScryfallCard, searchCardByName } from "./providers/scryfall.provider";

// So trata MTG por enquanto - quando entrar Pokemon, isso precisa
// receber um `game` e escolher o provider/mapper certo.
export async function getCardByName(name: string) {

    const normalizedName = name.trim().replace(/\+/g, " ");
    const cached = await prisma.card.findFirst({
        where: {
        name: { equals: normalizedName, mode: "insensitive" },
        game: "mtg",
        },
    });

  if (cached) {
    console.log(`Carta ${normalizedName} encontrada no cache.`);
    return mapScryfallCard(cached.rawData);
  }

  const raw = await searchCardByName(name);
  console.log(`Carta ${normalizedName} não encontrada no cache. Buscando na Scryfall...`);

await prisma.card.upsert({
  where: { externalId_game: { externalId: raw.id, game: "mtg" } },
  create: { externalId: raw.id, game: "mtg", name: raw.name, imageUrl: raw.image_uris?.normal ?? "", text: raw.oracle_text ?? null, rawData: raw },
  update: {},
});

  return mapScryfallCard(raw);
}
