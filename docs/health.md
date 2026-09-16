# API de Monitoramento (Health) — Documentação

Documentação de referência para o endpoint de verificação de integridade e status da API.

## Base URL
`/api`

## Autenticação

Este endpoint é público e não requer autenticação.

---

## Endpoints

### Verificar status do servidor

`GET /health`

Endpoint de monitoramento (ping) utilizado para verificar se a API está online e respondendo adequadamente.

**Resposta (200 OK)**

```json
{
"status": "ok",
"timestamp": "2026-09-16T12:00:00.000Z"
}
```