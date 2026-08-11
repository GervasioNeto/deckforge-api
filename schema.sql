-- ============================================================
-- DECKFORGE - SCHEMA DO BANCO DE DADOS
-- PostgreSQL (Supabase)
-- ============================================================
-- Este arquivo é a fonte da verdade da estrutura do banco.
-- Sempre que uma nova funcionalidade for adicionada, atualize
-- este arquivo ANTES de pedir pra IA implementar a feature,
-- assim ela sempre trabalha com o schema real do projeto.
-- ============================================================

-- ------------------------------------------------------------
-- CORE: usuários
-- ------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CORE: cache de cartas (Scryfall / Pokémon TCG API)
-- Estratégia cache-aside: só grava aqui quando alguém busca
-- uma carta que ainda não existe no banco.
-- ------------------------------------------------------------
CREATE TABLE cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(120) NOT NULL,      -- id da carta na API de origem
  game        VARCHAR(20) NOT NULL CHECK (game IN ('mtg', 'pokemon')),
  name        VARCHAR(255) NOT NULL,
  image_url   TEXT NOT NULL,
  text        TEXT,
  raw_data    JSONB NOT NULL,             -- resposta completa da API, pra não perder campo nenhum
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_id, game)
);

CREATE INDEX idx_cards_name ON cards USING GIN (to_tsvector('simple', name));

-- ------------------------------------------------------------
-- CORE: decks
-- ------------------------------------------------------------
CREATE TABLE decks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(120) NOT NULL,
  game         VARCHAR(20) NOT NULL CHECK (game IN ('mtg', 'pokemon')),
  visibility   VARCHAR(10) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  share_token  UUID DEFAULT gen_random_uuid(),  -- usado no link de compartilhamento
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_decks_share_token ON decks(share_token);

-- ------------------------------------------------------------
-- CORE: cartas dentro de um deck (tabela de junção)
-- ------------------------------------------------------------
CREATE TABLE deck_cards (
  deck_id  UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  card_id  UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  quantity SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (deck_id, card_id)
);

-- ============================================================
-- EXTENSÃO FUTURA: coleção pessoal + troca de cartas
-- (ainda não implementar no backend — só documentado aqui pra
-- já deixar o schema coerente quando a feature for iniciada)
-- ============================================================

-- Coleção física do usuário (o que ele realmente possui,
-- separado dos decks que são só "listas de jogo")
CREATE TABLE user_collection (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id      UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition    VARCHAR(20) DEFAULT 'near_mint'
               CHECK (condition IN ('mint', 'near_mint', 'lightly_played', 'played', 'damaged')),
  is_for_trade BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id, condition)
);

-- Anúncio de troca (uma carta específica da coleção disponível pra trocar)
CREATE TABLE trade_listings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_collection_id  UUID NOT NULL REFERENCES user_collection(id) ON DELETE CASCADE,
  status              VARCHAR(20) NOT NULL DEFAULT 'available'
                       CHECK (status IN ('available', 'reserved', 'completed', 'cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proposta de troca feita por outro usuário sobre um anúncio
CREATE TABLE trade_offers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES trade_listings(id) ON DELETE CASCADE,
  offered_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offered_card_id   UUID REFERENCES cards(id),  -- carta oferecida em troca (opcional, pode ser oferta em dinheiro/outro)
  message           TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
