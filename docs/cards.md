# API de Cartas — Documentação

Documentação de referência para os endpoints de busca de cartas da API do DeckForge.

## Base URL

`/api`

## Autenticação

Este endpoint é público e não requer autenticação.

---

## Endpoints

### Buscar carta por nome

`GET /cards`

Busca as informações de uma carta específica pelo nome (utilizando serviços externos como Scryfall ou Pokémon TCG API).

**Query params**

| Nome | Tipo   | Obrigatório | Descrição                                    |
| ---- | ------ | ----------- | -------------------------------------------- |
| name | string | sim         | Nome exato ou parcial da carta a ser buscada |

**Exemplo de Requisição**

`GET /cards?name=Pikachu`

**Resposta (200 OK)**

Retorna o objeto detalhado da carta encontrada no serviço externo.

**Erros Comuns**

| Código | Significado                                                 |
| ------ | ----------------------------------------------------------- |
| 400    | O parâmetro 'name' é obrigatório ou possui formato inválido |
| 500    | Erro interno ao buscar carta no serviço externo             |
