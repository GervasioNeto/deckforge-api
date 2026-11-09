# API de Usuários — Documentação

Documentação de referência para os endpoints de gerenciamento de perfil de usuários.

## Base URL

`/api`

## Autenticação

As rotas de usuário exigem um token Bearer válido no header da requisição.

`Authorization: Bearer {seu_token}`

---

## Endpoints

### Buscar perfil do usuário autenticado

`GET /me`

Retorna os dados cadastrais do próprio usuário que está logado no momento.

**Resposta (200 OK)**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Mestre Pokemon Emerson",
  "email": "teste@deckforge.com",
  "createdAt": "2026-09-15T10:00:00Z",
  "updatedAt": "2026-09-15T10:00:00Z"
}
```

**Erros Comuns**

| **Código** | **Significado**                         |
| ---------- | --------------------------------------- |
| 401        | Token ausente, inválido ou expirado     |
| 404        | Perfil não encontrado no banco de dados |

---

### Atualizar o próprio nome

`PATCH /me` (exige token). Corpo: `{ "name": "Novo nome" }`, de 1 a 60 caracteres. Responde `200` com o perfil atualizado e `400` (`VALIDATION_ERROR`) para um nome inválido.

### Buscar usuários

`GET /users/search?q=texto` (pública). Busca por nome, sem diferenciar maiúsculas, e devolve no máximo 20 resultados, nunca o e-mail. Com menos de 2 caracteres, responde lista vazia.

```json
{
  "users": [
    { "id": "123e4567-e89b-12d3-a456-426614174000", "name": "Emerson", "createdAt": "2026-09-15T10:00:00Z", "publicDeckCount": 3 }
  ]
}
```

Contas sem nome salvo aparecem como `Jogador` nas respostas públicas.
