-- ============================================================
-- MIGRAÇÃO: editor de decks (formato, descrição, capa e boards)
-- Rode uma vez no SQL Editor do Supabase em bancos criados antes
-- desta versão do schema.sql. É idempotente: rodar de novo não
-- quebra nada.
-- ============================================================
BEGIN;

ALTER TABLE decks
  ADD COLUMN IF NOT EXISTS format VARCHAR(20),
  ADD COLUMN IF NOT EXISTS description TEXT CHECK (char_length(description) <= 2000),
  ADD COLUMN IF NOT EXISTS cover_card_id UUID REFERENCES cards(id) ON DELETE SET NULL;

-- Todas as cartas que já estavam nos decks vão pro deck principal.
ALTER TABLE deck_cards
  ADD COLUMN IF NOT EXISTS board VARCHAR(10) NOT NULL DEFAULT 'main'
    CHECK (board IN ('main', 'side', 'maybe', 'commander'));

-- A chave passa a incluir o board, pra mesma carta poder estar no main e no side.
ALTER TABLE deck_cards DROP CONSTRAINT IF EXISTS deck_cards_pkey;
ALTER TABLE deck_cards ADD PRIMARY KEY (deck_id, card_id, board);

COMMIT;
