# DeckForge API 👾

O **DeckForge** é uma plataforma unificada projetada para ajudar jogadores de _Magic: The Gathering_ e _Pokémon TCG_ a organizar, gerenciar e compartilhar seus decks de forma prática.

Esta API atua como o backend da aplicação. Nosso grande diferencial arquitetural é que **não armazenamos os dados das cartas no nosso banco de dados**. Em vez disso, a API consome dados em tempo real de APIs externas especializadas, garantindo informações sempre atualizadas, listas precisas e otimizando radicalmente o armazenamento do nosso lado.

## ✨ Funcionalidades Principais

- **Gestão de Perfis:** Criação de conta e autenticação de usuários.
- **Montagem de Decks:** Criação e organização de decks personalizados de MTG e Pokémon TCG.
- **Controle de Coleção:** Visualização facilitada para o usuário saber exatamente quantos e quais tipos de decks ele possui.
- **Compartilhamento:** Geração de links para que o usuário possa compartilhar seus decks com amigos.
- **Manutenção:** Exclusão de decks obsoletos ou que não são mais utilizados.
- **Integração Inteligente:** Busca e listagem de cartas diretamente via APIs de terceiros (Scryfall e Pokémon TCG API).

---

## 🛠️ Tecnologias Utilizadas

Este projeto foi desenvolvido com as seguintes ferramentas:

- **Node.js** com **Express**
- **TypeScript**
- **Prisma ORM** (Integração com PostgreSQL)
- **Supabase** (Banco de Dados e Autenticação)
- Integração com **Pokémon TCG API** e **Scryfall API**

---

## ⚙️ Variáveis de Ambiente

Para rodar o projeto, você precisará configurar as variáveis de ambiente. Na raiz do projeto, renomeie o arquivo `.env.example` para `.env` e preencha com as suas credenciais:

- `PORT` (Padrão: 3333)
- `DATABASE_URL` (URL de connection pooling do Supabase)
- `DIRECT_URL` (URL de conexão direta do Supabase, usada pelo Prisma)
- `SUPABASE_URL` e `SUPABASE_ANON_KEY` (Chaves do projeto no Supabase)
- `POKEMON_TCG_API_KEY` (Chave de acesso da API do Pokémon TCG)

---

## 📌 Estrutura de Rotas

A API está dividida nos seguintes módulos principais:

- `/health` - Verificação de integridade da API e status dos serviços.
- `/users` - Rotas relacionadas à gestão e autenticação de usuários.
- `/cards` - Consulta e manipulação de cartas (Integrações MTG / Pokémon).
- `/decks` - Criação, listagem, compartilhamento e gerenciamento dos decks.

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos

- Node.js instalado
- Conta ativa no Supabase (com o banco configurado)
- Chave de API do Pokémon TCG

### Passo a Passo

1. **Instale as dependências do projeto:**
   ```bash
   npm install
   ```
2. **Gerar aquivos do Prisma Client**
   ```bash
   npm run prisma:generate
   ```
3. **Iniciar o Servidor em modo de Desenvolvimento (Dev Mode)**
   ```bash
   npm run dev
   ```
