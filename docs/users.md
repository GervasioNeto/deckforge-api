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
