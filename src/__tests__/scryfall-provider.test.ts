import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCardPrints } from "../modules/cards/providers/scryfall.provider";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("searchCardPrints", () => {
  it("lista todas as impressões do nome exato, da mais nova para a mais antiga", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ object: "list", data: [{ id: "sld-83" }, { id: "lea-161" }] }));

    const prints = await searchCardPrints("Lightning Bolt");

    expect(prints.map((card) => card.id)).toEqual(["sld-83", "lea-161"]);
    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get("q")).toBe('!"Lightning Bolt"');
    expect(params.get("unique")).toBe("prints");
    expect(params.get("order")).toBe("released");
    expect(params.get("dir")).toBe("desc");
  });

  it("devolve a lista vazia quando a Scryfall não acha nada (ela responde 404)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ object: "error", code: "not_found", status: 404 }, 404));

    await expect(searchCardPrints("Carta Inventada")).resolves.toEqual([]);
  });

  it("não engole os outros erros da Scryfall", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ object: "error", status: 503, details: "manutenção" }, 503));

    await expect(searchCardPrints("Lightning Bolt")).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
  });
});
