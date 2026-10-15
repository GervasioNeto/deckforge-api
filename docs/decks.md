# API de Decks — Documentação

Endpoints para criar, ver, editar e montar decks.

## Base URL

`/api`

## Autenticação

Todas as rotas exigem `Authorization: Bearer <token>`, exceto:

- `GET /decks/public` — pública.
- `GET /decks/:deckId` — o token é opcional: sem ele, só decks públicos aparecem.

Um deck de outro usuário responde `404 DECK_NOT_FOUND` (nunca `403`), para não revelar que ele existe.

## Conceitos

**Boards**: cada carta de um deck fica num board.

| Board       | Descrição                                           |
| ----------- | --------------------------------------------------- |
| `main`      | Deck principal (padrão)                             |
| `side`      | Sideboard                                           |
| `maybe`     | Maybeboard: cartas em avaliação, não contam no deck |
| `commander` | Zona de comandante (formato Commander)              |

A mesma carta pode estar em mais de um board. `cardCount` soma só `main` e `commander`.

**Formatos** (`format`, `null` = sem formato):

| Jogo      | Formatos                                                                    |
| --------- | --------------------------------------------------------------------------- |
| `mtg`     | `standard`, `pioneer`, `modern`, `legacy`, `vintage`, `pauper`, `commander` |
| `pokemon` | `standard`, `expanded`, `unlimited`                                         |

**IDs de carta**: `cards[].id` é o ID interno (usado nas rotas `/decks/:deckId/cards/:cardId`); `cards[].externalId` é o da Scryfall.

---

## Endpoints

### Listar meus decks

`GET /decks`

Decks do usuário logado, mais recentes primeiro, com `cardCount` e `coverImageUrl` (a capa escolhida, o comandante ou a carta com mais cópias).

### Listar decks públicos

`GET /decks/public?game=mtg`

`game` é opcional (`mtg` ou `pokemon`). Cada deck vem com `user: { id, name }`.

### Criar deck

`POST /decks`

```json
{ "name": "Dimir Control", "game": "mtg", "visibility": "private", "format": "standard", "description": "..." }
```

`name` (até 120 caracteres) e `game` são obrigatórios. Responde `201` com o deck.

### Ver deck

`GET /decks/:deckId`

```json
{
  "id": "…",
  "name": "Dimir Control",
  "game": "mtg",
  "format": "standard",
  "description": null,
  "visibility": "public",
  "coverCardId": null,
  "coverImageUrl": "https://cards.scryfall.io/normal/…",
  "shareToken": "…",
  "createdAt": "…",
  "updatedAt": "…",
  "isOwner": true,
  "author": { "id": "…", "name": "Gervásio" },
  "cardCount": 60,
  "cards": [
    {
      "id": "uuid interno",
      "externalId": "id da Scryfall",
      "board": "main",
      "quantity": 4,
      "name": "Deceit",
      "manaCost": "{4}{U}{B}",
      "cmc": 6,
      "typeLine": "Creature — Elemental Incarnation",
      "text": "…",
      "colors": ["U", "B"],
      "colorIdentity": ["U", "B"],
      "rarity": "mythic",
      "setCode": "mh3",
      "setName": "Modern Horizons 3",
      "collectorNumber": "212",
      "imageUrl": "…",
      "backImageUrl": null,
      "power": "5",
      "toughness": "5",
      "loyalty": null,
      "faces": null,
      "legalities": { "standard": "not_legal", "modern": "legal" },
      "scryfallUrl": "…"
    }
  ]
}
```

`shareToken` só vem para o dono. `faces` lista as faces de cartas duplas/divididas; `backImageUrl` é a imagem do verso (cartas transform/MDFC).

### Editar deck

`PATCH /decks/:deckId`

Atualização parcial: envie só o que muda.

```json
{ "name": "Novo nome", "visibility": "public", "format": "modern", "description": "…", "coverCardId": "uuid interno" }
```

`format` e `description` aceitam `null`. `coverCardId` precisa ser uma carta do deck. Responde `200` com o deck completo (mesmo formato do GET).

### Excluir deck

`DELETE /decks/:deckId` → `204`.

### Duplicar deck

`POST /decks/:deckId/duplicate`

Copia um deck próprio ou público de outra pessoa para a conta do usuário. A cópia se chama `"<nome> (cópia)"` e nasce privada. Responde `201` com o novo deck.

---

## Cartas do deck

Todas estas rotas respondem `200` com o deck completo já atualizado (mesmo formato do GET).

### Adicionar carta

`POST /decks/:deckId/cards`

```json
{ "name": "Lightning Bolt", "quantity": 4, "board": "main" }
```

Use `externalId` (de `GET /cards`) **ou** `name`. `quantity` (1–999) e `board` são opcionais (padrão `1` e `main`); cópias se somam às que já estão no board.

### Definir quantidade

`PATCH /decks/:deckId/cards/:cardId?board=main`

```json
{ "quantity": 3 }
```

Quantidade exata (0–999). `0` tira a carta do board.

### Mover entre boards

`POST /decks/:deckId/cards/:cardId/move`

```json
{ "from": "main", "to": "side", "quantity": 1 }
```

`quantity` é opcional (padrão: todas as cópias). As cópias se somam às que já estiverem no destino.

### Remover uma cópia

`DELETE /decks/:deckId/cards/:cardId?board=main`

Remove uma cópia; na última, tira a carta do board.

### Importar lista

`POST /decks/:deckId/cards/import`

```json
{
  "entries": [
    { "name": "Lightning Bolt", "quantity": 4, "board": "main" },
    { "name": "Negate", "quantity": 2, "board": "side" }
  ],
  "replace": false
}
```

Até 250 linhas. Os nomes são resolvidos no cache, depois na Scryfall pelo nome exato e, por fim, pela busca aproximada. `replace: true` troca todo o conteúdo do deck.

```json
{ "deck": { "…": "deck completo" }, "imported": 6, "notFound": ["Carta Inventada"] }
```

---

## Erros Comuns

| Código | `error`               | Significado                                         |
| ------ | --------------------- | --------------------------------------------------- |
| 400    | `INVALID_DECK_ID`     | `deckId` não é um UUID                              |
| 400    | `INVALID_CARD_ID`     | `cardId` não é um UUID                              |
| 400    | `VALIDATION_ERROR`    | Corpo ou query inválidos (a `message` diz qual)     |
| 400    | `GAME_NOT_SUPPORTED`  | Cartas desse jogo ainda não são suportadas          |
| 401    | `UNAUTHORIZED`        | Token ausente, inválido ou expirado                 |
| 404    | `DECK_NOT_FOUND`      | Deck não existe ou não é acessível a este usuário   |
| 404    | `CARD_NOT_FOUND`      | Carta não encontrada na Scryfall                    |
| 404    | `CARD_NOT_IN_DECK`    | A carta não está nesse board do deck                |
| 422    | `NO_CARDS_RECOGNIZED` | Nenhuma carta da lista importada foi reconhecida    |
| 502    | `UPSTREAM_ERROR`      | A Scryfall falhou                                   |
