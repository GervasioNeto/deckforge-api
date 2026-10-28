# API de Cartas — Documentação

Documentação de referência para os endpoints de busca de cartas da API do DeckForge.

## Base URL

`/api`

## Autenticação

Estes endpoints são públicos e não requerem autenticação.

## Jogos

Todas as rotas aceitam `?game=`:

| `game`         | API externa                                    |
| -------------- | ---------------------------------------------- |
| `mtg` (padrão) | [Scryfall](https://scryfall.com/docs/api)      |
| `pokemon`      | [Pokémon TCG API](https://docs.pokemontcg.io/) |

Sem `game`, vale `mtg`. Outro valor responde `400 VALIDATION_ERROR`.

As cartas buscadas ficam em cache no banco (separadas por jogo). A próxima busca da mesma carta não consulta a API externa.

---

## Endpoints

### Buscar carta por nome

`GET /cards`

Busca as informações de uma carta pelo nome.

- **Magic**: busca aproximada da Scryfall (`bolt` acha "Lightning Bolt").
- **Pokémon**: nome exato, sem diferenciar maiúsculas, e vem a impressão mais recente.

**Query params**

| Nome | Tipo   | Obrigatório | Descrição                    |
| ---- | ------ | ----------- | ---------------------------- |
| name | string | sim         | Nome da carta                |
| game | string | não         | `mtg` (padrão) ou `pokemon`  |

**Exemplo de Requisição**

`GET /cards?name=Charizard&game=pokemon`

**Resposta (200 OK)**

Os campos comuns têm o mesmo nome e formato nos dois jogos: `id`, `name`, `typeLine`, `imageUrl`, `rarity`, `setName`, `collectorNumber` e `legalities`.

Em `legalities`, os valores são `legal`, `not_legal` e `banned` (no Magic também `restricted`).

Magic (os campos são os do mapper da Scryfall, o mesmo formato de `cards[]` em [decks.md](decks.md)):

```json
{
  "id": "id da Scryfall",
  "name": "Lightning Bolt",
  "manaCost": "{R}",
  "cmc": 1,
  "typeLine": "Instant",
  "text": "Lightning Bolt deals 3 damage to any target.",
  "colors": ["R"],
  "rarity": "uncommon",
  "setName": "Magic 2010",
  "collectorNumber": "146",
  "imageUrl": "…",
  "legalities": { "modern": "legal", "standard": "not_legal" }
}
```

Pokémon:

```json
{
  "id": "base1-4",
  "name": "Charizard",
  "typeLine": "Pokémon — Stage 2",
  "imageUrl": "https://images.pokemontcg.io/base1/4_hires.png",
  "rarity": "Rare Holo",
  "setName": "Base",
  "collectorNumber": "4",
  "legalities": { "standard": "not_legal", "expanded": "not_legal", "unlimited": "legal" },
  "supertype": "Pokémon",
  "subtypes": ["Stage 2"],
  "hp": 120,
  "types": ["Fire"],
  "attacks": [{ "name": "Fire Spin", "cost": ["Fire", "Fire", "Fire", "Fire"], "damage": "100", "text": "…" }],
  "abilities": [{ "name": "Energy Burn", "type": "Pokémon Power", "text": "…" }],
  "weaknesses": [{ "type": "Water", "value": "×2" }],
  "resistances": [{ "type": "Fighting", "value": "-30" }],
  "retreatCost": ["Colorless", "Colorless", "Colorless"],
  "regulationMark": null,
  "rules": []
}
```

Como os campos do Pokémon se comportam:

- `supertype` é `Pokémon`, `Trainer` ou `Energy`.
- Treinadores e Energias vêm com `hp: null` e com listas vazias nos campos que não têm.
- `damage` pode ter modificador (`"30+"`, `"20×"`) e é `null` em ataque sem dano.
- `legalities` sempre traz os três formatos.

---

### Sugerir nomes de cartas (autocomplete)

`GET /cards/autocomplete`

Até 20 nomes de cartas que batem com o texto digitado. Não grava nada no cache.

- **Magic**: o autocomplete da Scryfall.
- **Pokémon**: cada palavra digitada vale como início de uma palavra do nome (`mega char` → "Mega Charizard X ex"). Os nomes que começam com o texto vêm primeiro.

**Query params**

| Nome | Tipo   | Obrigatório | Descrição                                                    |
| ---- | ------ | ----------- | ------------------------------------------------------------ |
| q    | string | sim         | Texto digitado. Com menos de 2 caracteres, a lista vem vazia |
| game | string | não         | `mtg` (padrão) ou `pokemon`                                  |

**Exemplo de Requisição**

`GET /cards/autocomplete?q=lightning`

**Resposta (200 OK)**

```json
{ "names": ["Lightning Bolt", "Lightning Helix", "Lightning Greaves"] }
```

---

### Listar impressões de uma carta

`GET /cards/search`

Lista as impressões (edições) de uma carta, da mais nova para a mais antiga, para o usuário escolher a arte. Para adicionar a escolhida ao deck, envie o `externalId` dela para `POST /decks/:deckId/cards`.

Vem só a primeira página da API externa: até 175 impressões no Magic e 250 no Pokémon. Não grava nada no cache.

**Query params**

| Nome | Tipo   | Obrigatório | Descrição                       |
| ---- | ------ | ----------- | ------------------------------- |
| q    | string | sim         | Nome exato da carta             |
| game | string | não         | `mtg` (padrão) ou `pokemon`     |

**Exemplo de Requisição**

`GET /cards/search?q=Charizard&game=pokemon`

**Resposta (200 OK)**

```json
{
  "prints": [
    {
      "externalId": "me55c-4",
      "name": "Charizard",
      "imageUrl": "https://images.pokemontcg.io/me55c/4_hires.png",
      "setName": "30th Celebration: Classic Collection",
      "collectorNumber": "4"
    },
    {
      "externalId": "base1-4",
      "name": "Charizard",
      "imageUrl": "https://images.pokemontcg.io/base1/4_hires.png",
      "setName": "Base",
      "collectorNumber": "4"
    }
  ]
}
```

Um nome sem nenhuma impressão responde `200` com `{ "prints": [] }`.

---

## Erros Comuns

| Código | `error`            | Significado                                                       |
| ------ | ------------------ | ----------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | `name`/`q` ausente ou em branco, ou `game` inválido               |
| 404    | `CARD_NOT_FOUND`   | Carta não encontrada na API externa (só em `GET /cards`)          |
| 502    | `UPSTREAM_ERROR`   | A API externa falhou ou não pôde ser consultada                   |
| 504    | `UPSTREAM_ERROR`   | A Pokémon TCG API não respondeu em 10s                            |
