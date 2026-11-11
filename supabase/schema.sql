-- ============================================================================
-- NEON DROP // SUPABASE SERVER-AUTHORITATIVE SCHEMA & ANTI-CHEAT RPCs
-- Execute este script no SQL Editor do seu projeto Supabase (https://supabase.com)
--
-- O script é IDEMPOTENTE: pode ser rodado de novo por cima de um banco que já
-- tem uma versão anterior dele (tabelas são mantidas, funções são substituídas).
--
-- PRÉ-REQUISITO: Authentication → Sign In / Providers → "Allow anonymous sign-ins"
-- precisa estar LIGADO. Cada navegador recebe uma conta anônima do Supabase Auth e
-- a linha em `profiles` pertence a essa conta (profiles.id = auth.uid()).
--
-- O QUE VIVE NO SERVIDOR: saldo, inventário, sorteio das caixas, contratos de troca,
-- prestígio, XP, renda passiva, recompensa do Gridshot e os números do Ranking Global.
-- O cliente só chama as RPCs abaixo e desenha o que elas devolvem.
--
-- ATENÇÃO: perfis sem conta de Auth correspondente (criados antes do login anônimo,
-- incluindo a linha de teste `test_op`) são APAGADOS na seção de migração abaixo.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================================
-- TABELAS
-- ============================================================================

-- 1. PERFIS DE OPERADORES (ESTADO OFICIAL NO SERVIDOR)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT UNIQUE,
  callsign CITEXT UNIQUE, -- CITEXT garante unicidade case-insensitive no motor do Postgres
  callsign_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  balance NUMERIC(16, 2) NOT NULL DEFAULT 500.00 CHECK (balance >= 0),
  net_worth NUMERIC(16, 2) NOT NULL DEFAULT 500.00 CHECK (net_worth >= 0),
  passive_rate_per_sec NUMERIC(14, 4) NOT NULL DEFAULT 0.1500,
  last_claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prestige_level INT NOT NULL DEFAULT 0 CHECK (prestige_level BETWEEN 0 AND 10),
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  mil_level INT NOT NULL DEFAULT 1 CHECK (mil_level BETWEEN 1 AND 55),
  unique_skins_count INT NOT NULL DEFAULT 0,
  platinum_cases_count INT NOT NULL DEFAULT 0,
  cases_opened INT NOT NULL DEFAULT 0,
  golds_unboxed INT NOT NULL DEFAULT 0,
  tradeups_done INT NOT NULL DEFAULT 0,
  best_drop_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  best_gridshot_score INT NOT NULL DEFAULT 0,
  next_gridshot_allowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  vip_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT callsign_length_check CHECK (callsign IS NULL OR (char_length(callsign) BETWEEN 3 AND 18))
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_spent NUMERIC(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_earned NUMERIC(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS targets_hit BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legacy_imported BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. INVENTÁRIO DE SKINS & LÂMINAS
CREATE TABLE IF NOT EXISTS public.inventory_items (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('blue', 'purple', 'pink', 'red', 'gold')),
  shape TEXT NOT NULL,
  c1 TEXT NOT NULL,
  c2 TEXT NOT NULL,
  pattern TEXT NOT NULL,
  float_val NUMERIC(6, 5) NOT NULL,
  wear_short TEXT NOT NULL,
  stat_trak BOOLEAN NOT NULL DEFAULT FALSE,
  kills INT NOT NULL DEFAULT 0 CHECK (kills >= 0),
  is_heirloom BOOLEAN NOT NULL DEFAULT FALSE,
  price NUMERIC(14, 2) NOT NULL CHECK (price > 0),
  obtained_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON public.inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user_template ON public.inventory_items(user_id, template_id);

-- 3. SESSÕES DO AIM LAB (GRIDSHOT 30s ANTI-MACRO)
CREATE TABLE IF NOT EXISTS public.gridshot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  score INT,
  hits INT,
  shots INT,
  reward_paid NUMERIC(14, 2) DEFAULT 0.00,
  flagged_cheat BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_gridshot_sessions_user ON public.gridshot_sessions(user_id);

-- 4. AUDITORIA DE PAGAMENTOS (PIX / STRIPE WEBHOOK IDEMPOTENCY)
CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_tx_id TEXT NOT NULL UNIQUE, -- Impede crédito duplicado do mesmo Pix/Stripe
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  amount_brl NUMERIC(10, 2) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. CATÁLOGO OFICIAL (18 caixas, 252 skins) — o servidor sorteia a partir daqui
CREATE TABLE IF NOT EXISTS public.case_catalog (
  id TEXT PRIMARY KEY,
  tier INT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price > 0)
);

CREATE TABLE IF NOT EXISTS public.item_catalog (
  template_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES public.case_catalog(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('blue', 'purple', 'pink', 'red', 'gold')),
  shape TEXT NOT NULL,
  c1 TEXT NOT NULL,
  c2 TEXT NOT NULL,
  pattern TEXT NOT NULL,
  base_price NUMERIC(14, 2) NOT NULL CHECK (base_price > 0)
);

CREATE INDEX IF NOT EXISTS idx_item_catalog_case_rarity ON public.item_catalog(case_id, rarity);

-- 6. CONFIGURAÇÕES DO SERVIDOR
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Janela para importar o save antigo do navegador (uma vez por conta, só em perfil zerado).
-- Para fechar antes: UPDATE public.app_settings SET value = now()::text WHERE key = 'legacy_import_until';
INSERT INTO public.app_settings (key, value)
VALUES ('legacy_import_until', (now() + interval '7 days')::text)
ON CONFLICT (key) DO NOTHING;

-- <catalog-seed> (gerado por tools/build-catalog-sql.mjs — não edite à mão)
INSERT INTO public.case_catalog (id, tier, name, price) VALUES
  ('nx_t1_1', 1, '[T1] Maleta Cyber-Vanguard', 25),
  ('nx_t1_2', 1, '[T1] Maleta Operação Névoa', 35),
  ('nx_t1_3', 1, '[T1] Maleta Patrulha Kestrel', 45),
  ('nx_t2_1', 2, '[T2] Contêiner Criogênico Zero', 120),
  ('nx_t2_2', 2, '[T2] Contêiner Biolumen Abissal', 165),
  ('nx_t2_3', 2, '[T2] Contêiner Reator Cobalto', 220),
  ('nx_t3_1', 3, '[T3] Cofre Hexagonal Solaris', 550),
  ('nx_t3_2', 3, '[T3] Cofre Blindado Overdrive', 750),
  ('nx_t3_3', 3, '[T3] Cofre Forja de Titânio', 950),
  ('nx_t4_1', 4, '[T4] Cápsula Vórtice Nulo', 2400),
  ('nx_t4_2', 4, '[T4] Cápsula Horizonte Astral', 3200),
  ('nx_t4_3', 4, '[T4] Cápsula Hiper-Pulso', 4200),
  ('nx_t5_1', 5, '[T5] Relicário Chrono-Valquíria', 10500),
  ('nx_t5_2', 5, '[T5] Relicário Eclipse Carmesim', 14000),
  ('nx_t5_3', 5, '[T5] Relicário Serafim Dourado', 18000),
  ('nx_t6_1', 6, '[T6] Sarcófago Quântico Ômega', 38000),
  ('nx_t6_2', 6, '[T6] Sarcófago Soberano Astral', 50000),
  ('nx_t6_3', 6, '[T6] Sarcófago Singularidade', 65000)
ON CONFLICT (id) DO UPDATE SET tier = EXCLUDED.tier, name = EXCLUDED.name, price = EXCLUDED.price;

INSERT INTO public.item_catalog (template_id, case_id, name, rarity, shape, c1, c2, pattern, base_price) VALUES
  ('nx_t1_1_b1', 'nx_t1_1', 'Kestrel-9 | Vanguard Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'carbon', 3.54),
  ('nx_t1_1_b2', 'nx_t1_1', 'Viper-7 | Vanguard Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'hex', 3.77),
  ('nx_t1_1_b3', 'nx_t1_1', 'Breacher-12 | Vanguard Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'circuit', 4.09),
  ('nx_t1_1_b4', 'nx_t1_1', 'Vector-X | Vanguard Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'carbon', 4.32),
  ('nx_t1_1_p1', 'nx_t1_1', 'Enforcer .50 | Vanguard Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'hex', 14.77),
  ('nx_t1_1_p2', 'nx_t1_1', 'Aegis-SSR | Vanguard Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'circuit', 16.66),
  ('nx_t1_1_k1', 'nx_t1_1', 'Phantom-M4 | Vanguard Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'carbon', 47.5),
  ('nx_t1_1_k2', 'nx_t1_1', 'Valkyrie-47 | Vanguard Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'hex', 52.5),
  ('nx_t1_1_r1', 'nx_t1_1', 'Titan-AWM | Vanguard Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 142.5),
  ('nx_t1_1_r2', 'nx_t1_1', 'Omega-Rail | Vanguard Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 159),
  ('nx_t1_1_g1', 'nx_t1_1', '★ Garra Karambit | Vanguard Safira', 'gold', 'karambit', '#0075ff', '#00e5ff', 'doppler', 460),
  ('nx_t1_1_g2', 'nx_t1_1', '★ Balisong Dual | Vanguard Rubi', 'gold', 'butterfly', '#ff1744', '#ff9100', 'doppler', 490),
  ('nx_t1_1_g3', 'nx_t1_1', '★ Baioneta M-Tática | Vanguard Esmeralda', 'gold', 'bayonet', '#00b24b', '#a7f3d0', 'doppler', 520),
  ('nx_t1_1_g4', 'nx_t1_1', '★ Manoplas Táticas | Vanguard Overclock', 'gold', 'gloves', '#8847ff', '#00e5ff', 'circuit', 550),
  ('nx_t1_2_b1', 'nx_t1_2', 'Kestrel-9 | Névoa Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'hex', 4.95),
  ('nx_t1_2_b2', 'nx_t1_2', 'Viper-7 | Névoa Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'tiger', 5.28),
  ('nx_t1_2_b3', 'nx_t1_2', 'Breacher-12 | Névoa Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'carbon', 5.72),
  ('nx_t1_2_b4', 'nx_t1_2', 'Vector-X | Névoa Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'hex', 6.05),
  ('nx_t1_2_p1', 'nx_t1_2', 'Enforcer .50 | Névoa Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'tiger', 20.68),
  ('nx_t1_2_p2', 'nx_t1_2', 'Aegis-SSR | Névoa Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'carbon', 23.32),
  ('nx_t1_2_k1', 'nx_t1_2', 'Phantom-M4 | Névoa Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'hex', 66.5),
  ('nx_t1_2_k2', 'nx_t1_2', 'Valkyrie-47 | Névoa Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'tiger', 73.5),
  ('nx_t1_2_r1', 'nx_t1_2', 'Titan-AWM | Névoa Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 199.5),
  ('nx_t1_2_r2', 'nx_t1_2', 'Omega-Rail | Névoa Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 222.6),
  ('nx_t1_2_g1', 'nx_t1_2', '★ Cyber-Tanto | Névoa Fade Solar', 'gold', 'tanto', '#ff007f', '#ffd700', 'fade', 644),
  ('nx_t1_2_g2', 'nx_t1_2', '★ Adaga Kunai | Névoa Ametista', 'gold', 'kunai', '#a855f7', '#ec4899', 'doppler', 686),
  ('nx_t1_2_g3', 'nx_t1_2', '★ Garra Karambit | Névoa Damasco Real', 'gold', 'karambit', '#e2e8f0', '#ffd700', 'damascus', 728),
  ('nx_t1_2_g4', 'nx_t1_2', '★ Manoplas Táticas | Névoa Carmesim', 'gold', 'gloves', '#ef4444', '#ffd700', 'hex', 770),
  ('nx_t1_3_b1', 'nx_t1_3', 'Kestrel-9 | Patrulha Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'tiger', 6.36),
  ('nx_t1_3_b2', 'nx_t1_3', 'Viper-7 | Patrulha Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'circuit', 6.79),
  ('nx_t1_3_b3', 'nx_t1_3', 'Breacher-12 | Patrulha Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'hex', 7.35),
  ('nx_t1_3_b4', 'nx_t1_3', 'Vector-X | Patrulha Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'tiger', 7.78),
  ('nx_t1_3_p1', 'nx_t1_3', 'Enforcer .50 | Patrulha Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'circuit', 26.59),
  ('nx_t1_3_p2', 'nx_t1_3', 'Aegis-SSR | Patrulha Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'hex', 29.98),
  ('nx_t1_3_k1', 'nx_t1_3', 'Phantom-M4 | Patrulha Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'tiger', 85.5),
  ('nx_t1_3_k2', 'nx_t1_3', 'Valkyrie-47 | Patrulha Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'circuit', 94.5),
  ('nx_t1_3_r1', 'nx_t1_3', 'Titan-AWM | Patrulha Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 256.5),
  ('nx_t1_3_r2', 'nx_t1_3', 'Omega-Rail | Patrulha Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 286.2),
  ('nx_t1_3_g1', 'nx_t1_3', '★ Balisong Dual | Patrulha Marble Fade', 'gold', 'butterfly', '#0075ff', '#ffd700', 'fade', 828),
  ('nx_t1_3_g2', 'nx_t1_3', '★ Cyber-Tanto | Patrulha Obsidiana', 'gold', 'tanto', '#00e5ff', '#6366f1', 'damascus', 882),
  ('nx_t1_3_g3', 'nx_t1_3', '★ Adaga Kunai | Patrulha Tigre Dourado', 'gold', 'kunai', '#ff9100', '#ffd700', 'tiger', 936),
  ('nx_t1_3_g4', 'nx_t1_3', '★ Baioneta M-Tática | Patrulha Supernova', 'gold', 'bayonet', '#d946ef', '#ffd700', 'doppler', 990),
  ('nx_t2_1_b1', 'nx_t2_1', 'Kestrel-9 | Subzero Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'circuit', 16.97),
  ('nx_t2_1_b2', 'nx_t2_1', 'Viper-7 | Subzero Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'damascus', 18.1),
  ('nx_t2_1_b3', 'nx_t2_1', 'Breacher-12 | Subzero Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'hex', 19.61),
  ('nx_t2_1_b4', 'nx_t2_1', 'Vector-X | Subzero Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'circuit', 20.74),
  ('nx_t2_1_p1', 'nx_t2_1', 'Enforcer .50 | Subzero Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'damascus', 70.9),
  ('nx_t2_1_p2', 'nx_t2_1', 'Aegis-SSR | Subzero Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'hex', 79.95),
  ('nx_t2_1_k1', 'nx_t2_1', 'Phantom-M4 | Subzero Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'circuit', 228),
  ('nx_t2_1_k2', 'nx_t2_1', 'Valkyrie-47 | Subzero Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'damascus', 252),
  ('nx_t2_1_r1', 'nx_t2_1', 'Titan-AWM | Subzero Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 684),
  ('nx_t2_1_r2', 'nx_t2_1', 'Omega-Rail | Subzero Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 763.2),
  ('nx_t2_1_g1', 'nx_t2_1', '★ Garra Karambit | Subzero Safira', 'gold', 'karambit', '#0075ff', '#00e5ff', 'doppler', 2208),
  ('nx_t2_1_g2', 'nx_t2_1', '★ Balisong Dual | Subzero Rubi', 'gold', 'butterfly', '#ff1744', '#ff9100', 'doppler', 2352),
  ('nx_t2_1_g3', 'nx_t2_1', '★ Baioneta M-Tática | Subzero Esmeralda', 'gold', 'bayonet', '#00b24b', '#a7f3d0', 'doppler', 2496),
  ('nx_t2_1_g4', 'nx_t2_1', '★ Manoplas Táticas | Subzero Overclock', 'gold', 'gloves', '#8847ff', '#00e5ff', 'circuit', 2640),
  ('nx_t2_2_b1', 'nx_t2_2', 'Kestrel-9 | Biolumen Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'doppler', 23.34),
  ('nx_t2_2_b2', 'nx_t2_2', 'Viper-7 | Biolumen Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'circuit', 24.89),
  ('nx_t2_2_b3', 'nx_t2_2', 'Breacher-12 | Biolumen Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'tiger', 26.97),
  ('nx_t2_2_b4', 'nx_t2_2', 'Vector-X | Biolumen Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'doppler', 28.52),
  ('nx_t2_2_p1', 'nx_t2_2', 'Enforcer .50 | Biolumen Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'circuit', 97.49),
  ('nx_t2_2_p2', 'nx_t2_2', 'Aegis-SSR | Biolumen Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'tiger', 109.94),
  ('nx_t2_2_k1', 'nx_t2_2', 'Phantom-M4 | Biolumen Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'doppler', 313.5),
  ('nx_t2_2_k2', 'nx_t2_2', 'Valkyrie-47 | Biolumen Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'circuit', 346.5),
  ('nx_t2_2_r1', 'nx_t2_2', 'Titan-AWM | Biolumen Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 940.5),
  ('nx_t2_2_r2', 'nx_t2_2', 'Omega-Rail | Biolumen Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 1049.4),
  ('nx_t2_2_g1', 'nx_t2_2', '★ Cyber-Tanto | Biolumen Fade Solar', 'gold', 'tanto', '#ff007f', '#ffd700', 'fade', 3036),
  ('nx_t2_2_g2', 'nx_t2_2', '★ Adaga Kunai | Biolumen Ametista', 'gold', 'kunai', '#a855f7', '#ec4899', 'doppler', 3234),
  ('nx_t2_2_g3', 'nx_t2_2', '★ Garra Karambit | Biolumen Damasco Real', 'gold', 'karambit', '#e2e8f0', '#ffd700', 'damascus', 3432),
  ('nx_t2_2_g4', 'nx_t2_2', '★ Manoplas Táticas | Biolumen Carmesim', 'gold', 'gloves', '#ef4444', '#ffd700', 'hex', 3630),
  ('nx_t2_3_b1', 'nx_t2_3', 'Kestrel-9 | Cobalto Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'damascus', 31.11),
  ('nx_t2_3_b2', 'nx_t2_3', 'Viper-7 | Cobalto Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'hex', 33.19),
  ('nx_t2_3_b3', 'nx_t2_3', 'Breacher-12 | Cobalto Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'doppler', 35.95),
  ('nx_t2_3_b4', 'nx_t2_3', 'Vector-X | Cobalto Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'damascus', 38.03),
  ('nx_t2_3_p1', 'nx_t2_3', 'Enforcer .50 | Cobalto Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'hex', 129.99),
  ('nx_t2_3_p2', 'nx_t2_3', 'Aegis-SSR | Cobalto Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'doppler', 146.58),
  ('nx_t2_3_k1', 'nx_t2_3', 'Phantom-M4 | Cobalto Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'damascus', 418),
  ('nx_t2_3_k2', 'nx_t2_3', 'Valkyrie-47 | Cobalto Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'hex', 462),
  ('nx_t2_3_r1', 'nx_t2_3', 'Titan-AWM | Cobalto Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 1254),
  ('nx_t2_3_r2', 'nx_t2_3', 'Omega-Rail | Cobalto Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 1399.2),
  ('nx_t2_3_g1', 'nx_t2_3', '★ Balisong Dual | Cobalto Marble Fade', 'gold', 'butterfly', '#0075ff', '#ffd700', 'fade', 4048),
  ('nx_t2_3_g2', 'nx_t2_3', '★ Cyber-Tanto | Cobalto Obsidiana', 'gold', 'tanto', '#00e5ff', '#6366f1', 'damascus', 4312),
  ('nx_t2_3_g3', 'nx_t2_3', '★ Adaga Kunai | Cobalto Tigre Dourado', 'gold', 'kunai', '#ff9100', '#ffd700', 'tiger', 4576),
  ('nx_t2_3_g4', 'nx_t2_3', '★ Baioneta M-Tática | Cobalto Supernova', 'gold', 'bayonet', '#d946ef', '#ffd700', 'doppler', 4840),
  ('nx_t3_1_b1', 'nx_t3_1', 'Kestrel-9 | Solaris Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'fade', 77.79),
  ('nx_t3_1_b2', 'nx_t3_1', 'Viper-7 | Solaris Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'tiger', 82.97),
  ('nx_t3_1_b3', 'nx_t3_1', 'Breacher-12 | Solaris Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'circuit', 89.89),
  ('nx_t3_1_b4', 'nx_t3_1', 'Vector-X | Solaris Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'fade', 95.07),
  ('nx_t3_1_p1', 'nx_t3_1', 'Enforcer .50 | Solaris Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'tiger', 324.97),
  ('nx_t3_1_p2', 'nx_t3_1', 'Aegis-SSR | Solaris Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'circuit', 366.46),
  ('nx_t3_1_k1', 'nx_t3_1', 'Phantom-M4 | Solaris Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'fade', 1045),
  ('nx_t3_1_k2', 'nx_t3_1', 'Valkyrie-47 | Solaris Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'tiger', 1155),
  ('nx_t3_1_r1', 'nx_t3_1', 'Titan-AWM | Solaris Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 3135),
  ('nx_t3_1_r2', 'nx_t3_1', 'Omega-Rail | Solaris Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 3498),
  ('nx_t3_1_g1', 'nx_t3_1', '★ Garra Karambit | Solaris Safira', 'gold', 'karambit', '#0075ff', '#00e5ff', 'doppler', 10120),
  ('nx_t3_1_g2', 'nx_t3_1', '★ Balisong Dual | Solaris Rubi', 'gold', 'butterfly', '#ff1744', '#ff9100', 'doppler', 10780),
  ('nx_t3_1_g3', 'nx_t3_1', '★ Baioneta M-Tática | Solaris Esmeralda', 'gold', 'bayonet', '#00b24b', '#a7f3d0', 'doppler', 11440),
  ('nx_t3_1_g4', 'nx_t3_1', '★ Manoplas Táticas | Solaris Overclock', 'gold', 'gloves', '#8847ff', '#00e5ff', 'circuit', 12100),
  ('nx_t3_2_b1', 'nx_t3_2', 'Kestrel-9 | Overdrive Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'circuit', 106.07),
  ('nx_t3_2_b2', 'nx_t3_2', 'Viper-7 | Overdrive Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'fade', 113.14),
  ('nx_t3_2_b3', 'nx_t3_2', 'Breacher-12 | Overdrive Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'doppler', 122.57),
  ('nx_t3_2_b4', 'nx_t3_2', 'Vector-X | Overdrive Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'circuit', 129.64),
  ('nx_t3_2_p1', 'nx_t3_2', 'Enforcer .50 | Overdrive Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'fade', 443.14),
  ('nx_t3_2_p2', 'nx_t3_2', 'Aegis-SSR | Overdrive Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'doppler', 499.71),
  ('nx_t3_2_k1', 'nx_t3_2', 'Phantom-M4 | Overdrive Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'circuit', 1425),
  ('nx_t3_2_k2', 'nx_t3_2', 'Valkyrie-47 | Overdrive Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'fade', 1575),
  ('nx_t3_2_r1', 'nx_t3_2', 'Titan-AWM | Overdrive Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 4275),
  ('nx_t3_2_r2', 'nx_t3_2', 'Omega-Rail | Overdrive Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 4770),
  ('nx_t3_2_g1', 'nx_t3_2', '★ Cyber-Tanto | Overdrive Fade Solar', 'gold', 'tanto', '#ff007f', '#ffd700', 'fade', 13800),
  ('nx_t3_2_g2', 'nx_t3_2', '★ Adaga Kunai | Overdrive Ametista', 'gold', 'kunai', '#a855f7', '#ec4899', 'doppler', 14700),
  ('nx_t3_2_g3', 'nx_t3_2', '★ Garra Karambit | Overdrive Damasco Real', 'gold', 'karambit', '#e2e8f0', '#ffd700', 'damascus', 15600),
  ('nx_t3_2_g4', 'nx_t3_2', '★ Manoplas Táticas | Overdrive Carmesim', 'gold', 'gloves', '#ef4444', '#ffd700', 'hex', 16500),
  ('nx_t3_3_b1', 'nx_t3_3', 'Kestrel-9 | Titânio Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'damascus', 134.36),
  ('nx_t3_3_b2', 'nx_t3_3', 'Viper-7 | Titânio Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'tiger', 143.31),
  ('nx_t3_3_b3', 'nx_t3_3', 'Breacher-12 | Titânio Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'fade', 155.26),
  ('nx_t3_3_b4', 'nx_t3_3', 'Vector-X | Titânio Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'damascus', 164.21),
  ('nx_t3_3_p1', 'nx_t3_3', 'Enforcer .50 | Titânio Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'tiger', 561.31),
  ('nx_t3_3_p2', 'nx_t3_3', 'Aegis-SSR | Titânio Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'fade', 632.97),
  ('nx_t3_3_k1', 'nx_t3_3', 'Phantom-M4 | Titânio Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'damascus', 1805),
  ('nx_t3_3_k2', 'nx_t3_3', 'Valkyrie-47 | Titânio Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'tiger', 1995),
  ('nx_t3_3_r1', 'nx_t3_3', 'Titan-AWM | Titânio Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 5415),
  ('nx_t3_3_r2', 'nx_t3_3', 'Omega-Rail | Titânio Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 6042),
  ('nx_t3_3_g1', 'nx_t3_3', '★ Balisong Dual | Titânio Marble Fade', 'gold', 'butterfly', '#0075ff', '#ffd700', 'fade', 17480),
  ('nx_t3_3_g2', 'nx_t3_3', '★ Cyber-Tanto | Titânio Obsidiana', 'gold', 'tanto', '#00e5ff', '#6366f1', 'damascus', 18620),
  ('nx_t3_3_g3', 'nx_t3_3', '★ Adaga Kunai | Titânio Tigre Dourado', 'gold', 'kunai', '#ff9100', '#ffd700', 'tiger', 19760),
  ('nx_t3_3_g4', 'nx_t3_3', '★ Baioneta M-Tática | Titânio Supernova', 'gold', 'bayonet', '#d946ef', '#ffd700', 'doppler', 20900),
  ('nx_t4_1_b1', 'nx_t4_1', 'Kestrel-9 | Vórtice Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'doppler', 339.43),
  ('nx_t4_1_b2', 'nx_t4_1', 'Viper-7 | Vórtice Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'circuit', 362.06),
  ('nx_t4_1_b3', 'nx_t4_1', 'Breacher-12 | Vórtice Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'damascus', 392.23),
  ('nx_t4_1_b4', 'nx_t4_1', 'Vector-X | Vórtice Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'doppler', 414.86),
  ('nx_t4_1_p1', 'nx_t4_1', 'Enforcer .50 | Vórtice Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'circuit', 1418.06),
  ('nx_t4_1_p2', 'nx_t4_1', 'Aegis-SSR | Vórtice Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'damascus', 1599.09),
  ('nx_t4_1_k1', 'nx_t4_1', 'Phantom-M4 | Vórtice Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'doppler', 4560),
  ('nx_t4_1_k2', 'nx_t4_1', 'Valkyrie-47 | Vórtice Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'circuit', 5040),
  ('nx_t4_1_r1', 'nx_t4_1', 'Titan-AWM | Vórtice Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 13680),
  ('nx_t4_1_r2', 'nx_t4_1', 'Omega-Rail | Vórtice Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 15264),
  ('nx_t4_1_g1', 'nx_t4_1', '★ Garra Karambit | Vórtice Safira', 'gold', 'karambit', '#0075ff', '#00e5ff', 'doppler', 44160),
  ('nx_t4_1_g2', 'nx_t4_1', '★ Balisong Dual | Vórtice Rubi', 'gold', 'butterfly', '#ff1744', '#ff9100', 'doppler', 47040),
  ('nx_t4_1_g3', 'nx_t4_1', '★ Baioneta M-Tática | Vórtice Esmeralda', 'gold', 'bayonet', '#00b24b', '#a7f3d0', 'doppler', 49920),
  ('nx_t4_1_g4', 'nx_t4_1', '★ Manoplas Táticas | Vórtice Overclock', 'gold', 'gloves', '#8847ff', '#00e5ff', 'circuit', 52800),
  ('nx_t4_2_b1', 'nx_t4_2', 'Kestrel-9 | Horizonte Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'fade', 452.57),
  ('nx_t4_2_b2', 'nx_t4_2', 'Viper-7 | Horizonte Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'doppler', 482.74),
  ('nx_t4_2_b3', 'nx_t4_2', 'Breacher-12 | Horizonte Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'hex', 522.97),
  ('nx_t4_2_b4', 'nx_t4_2', 'Vector-X | Horizonte Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'fade', 553.14),
  ('nx_t4_2_p1', 'nx_t4_2', 'Enforcer .50 | Horizonte Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'doppler', 1890.74),
  ('nx_t4_2_p2', 'nx_t4_2', 'Aegis-SSR | Horizonte Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'hex', 2132.11),
  ('nx_t4_2_k1', 'nx_t4_2', 'Phantom-M4 | Horizonte Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'fade', 6080),
  ('nx_t4_2_k2', 'nx_t4_2', 'Valkyrie-47 | Horizonte Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'doppler', 6720),
  ('nx_t4_2_r1', 'nx_t4_2', 'Titan-AWM | Horizonte Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 18240),
  ('nx_t4_2_r2', 'nx_t4_2', 'Omega-Rail | Horizonte Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 20352),
  ('nx_t4_2_g1', 'nx_t4_2', '★ Cyber-Tanto | Horizonte Fade Solar', 'gold', 'tanto', '#ff007f', '#ffd700', 'fade', 58880),
  ('nx_t4_2_g2', 'nx_t4_2', '★ Adaga Kunai | Horizonte Ametista', 'gold', 'kunai', '#a855f7', '#ec4899', 'doppler', 62720),
  ('nx_t4_2_g3', 'nx_t4_2', '★ Garra Karambit | Horizonte Damasco Real', 'gold', 'karambit', '#e2e8f0', '#ffd700', 'damascus', 66560),
  ('nx_t4_2_g4', 'nx_t4_2', '★ Manoplas Táticas | Horizonte Carmesim', 'gold', 'gloves', '#ef4444', '#ffd700', 'hex', 70400),
  ('nx_t4_3_b1', 'nx_t4_3', 'Kestrel-9 | Hiper-Pulso Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'circuit', 594),
  ('nx_t4_3_b2', 'nx_t4_3', 'Viper-7 | Hiper-Pulso Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'fade', 633.6),
  ('nx_t4_3_b3', 'nx_t4_3', 'Breacher-12 | Hiper-Pulso Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'tiger', 686.4),
  ('nx_t4_3_b4', 'nx_t4_3', 'Vector-X | Hiper-Pulso Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'circuit', 726),
  ('nx_t4_3_p1', 'nx_t4_3', 'Enforcer .50 | Hiper-Pulso Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'fade', 2481.6),
  ('nx_t4_3_p2', 'nx_t4_3', 'Aegis-SSR | Hiper-Pulso Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'tiger', 2798.4),
  ('nx_t4_3_k1', 'nx_t4_3', 'Phantom-M4 | Hiper-Pulso Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'circuit', 7980),
  ('nx_t4_3_k2', 'nx_t4_3', 'Valkyrie-47 | Hiper-Pulso Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'fade', 8820),
  ('nx_t4_3_r1', 'nx_t4_3', 'Titan-AWM | Hiper-Pulso Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 23940),
  ('nx_t4_3_r2', 'nx_t4_3', 'Omega-Rail | Hiper-Pulso Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 26712),
  ('nx_t4_3_g1', 'nx_t4_3', '★ Balisong Dual | Hiper-Pulso Marble Fade', 'gold', 'butterfly', '#0075ff', '#ffd700', 'fade', 77280),
  ('nx_t4_3_g2', 'nx_t4_3', '★ Cyber-Tanto | Hiper-Pulso Obsidiana', 'gold', 'tanto', '#00e5ff', '#6366f1', 'damascus', 82320),
  ('nx_t4_3_g3', 'nx_t4_3', '★ Adaga Kunai | Hiper-Pulso Tigre Dourado', 'gold', 'kunai', '#ff9100', '#ffd700', 'tiger', 87360),
  ('nx_t4_3_g4', 'nx_t4_3', '★ Baioneta M-Tática | Hiper-Pulso Supernova', 'gold', 'bayonet', '#d946ef', '#ffd700', 'doppler', 92400),
  ('nx_t5_1_b1', 'nx_t5_1', 'Kestrel-9 | Valquíria Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'fade', 1485),
  ('nx_t5_1_b2', 'nx_t5_1', 'Viper-7 | Valquíria Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'damascus', 1584),
  ('nx_t5_1_b3', 'nx_t5_1', 'Breacher-12 | Valquíria Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'doppler', 1716),
  ('nx_t5_1_b4', 'nx_t5_1', 'Vector-X | Valquíria Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'fade', 1815),
  ('nx_t5_1_p1', 'nx_t5_1', 'Enforcer .50 | Valquíria Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'damascus', 6204),
  ('nx_t5_1_p2', 'nx_t5_1', 'Aegis-SSR | Valquíria Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'doppler', 6996),
  ('nx_t5_1_k1', 'nx_t5_1', 'Phantom-M4 | Valquíria Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'fade', 19950),
  ('nx_t5_1_k2', 'nx_t5_1', 'Valkyrie-47 | Valquíria Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'damascus', 22050),
  ('nx_t5_1_r1', 'nx_t5_1', 'Titan-AWM | Valquíria Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 59850),
  ('nx_t5_1_r2', 'nx_t5_1', 'Omega-Rail | Valquíria Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 66780),
  ('nx_t5_1_g1', 'nx_t5_1', '★ Garra Karambit | Valquíria Safira', 'gold', 'karambit', '#0075ff', '#00e5ff', 'doppler', 193200),
  ('nx_t5_1_g2', 'nx_t5_1', '★ Balisong Dual | Valquíria Rubi', 'gold', 'butterfly', '#ff1744', '#ff9100', 'doppler', 205800),
  ('nx_t5_1_g3', 'nx_t5_1', '★ Baioneta M-Tática | Valquíria Esmeralda', 'gold', 'bayonet', '#00b24b', '#a7f3d0', 'doppler', 218400),
  ('nx_t5_1_g4', 'nx_t5_1', '★ Manoplas Táticas | Valquíria Overclock', 'gold', 'gloves', '#8847ff', '#00e5ff', 'circuit', 231000),
  ('nx_t5_2_b1', 'nx_t5_2', 'Kestrel-9 | Carmesim Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'doppler', 1980),
  ('nx_t5_2_b2', 'nx_t5_2', 'Viper-7 | Carmesim Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'tiger', 2112),
  ('nx_t5_2_b3', 'nx_t5_2', 'Breacher-12 | Carmesim Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'fade', 2288),
  ('nx_t5_2_b4', 'nx_t5_2', 'Vector-X | Carmesim Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'doppler', 2420),
  ('nx_t5_2_p1', 'nx_t5_2', 'Enforcer .50 | Carmesim Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'tiger', 8272),
  ('nx_t5_2_p2', 'nx_t5_2', 'Aegis-SSR | Carmesim Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'fade', 9328),
  ('nx_t5_2_k1', 'nx_t5_2', 'Phantom-M4 | Carmesim Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'doppler', 26600),
  ('nx_t5_2_k2', 'nx_t5_2', 'Valkyrie-47 | Carmesim Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'tiger', 29400),
  ('nx_t5_2_r1', 'nx_t5_2', 'Titan-AWM | Carmesim Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 79800),
  ('nx_t5_2_r2', 'nx_t5_2', 'Omega-Rail | Carmesim Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 89040),
  ('nx_t5_2_g1', 'nx_t5_2', '★ Cyber-Tanto | Carmesim Fade Solar', 'gold', 'tanto', '#ff007f', '#ffd700', 'fade', 257600),
  ('nx_t5_2_g2', 'nx_t5_2', '★ Adaga Kunai | Carmesim Ametista', 'gold', 'kunai', '#a855f7', '#ec4899', 'doppler', 274400),
  ('nx_t5_2_g3', 'nx_t5_2', '★ Garra Karambit | Carmesim Damasco Real', 'gold', 'karambit', '#e2e8f0', '#ffd700', 'damascus', 291200),
  ('nx_t5_2_g4', 'nx_t5_2', '★ Manoplas Táticas | Carmesim Carmesim', 'gold', 'gloves', '#ef4444', '#ffd700', 'hex', 308000),
  ('nx_t5_3_b1', 'nx_t5_3', 'Kestrel-9 | Serafim Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'damascus', 2545.71),
  ('nx_t5_3_b2', 'nx_t5_3', 'Viper-7 | Serafim Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'fade', 2715.43),
  ('nx_t5_3_b3', 'nx_t5_3', 'Breacher-12 | Serafim Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'circuit', 2941.71),
  ('nx_t5_3_b4', 'nx_t5_3', 'Vector-X | Serafim Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'damascus', 3111.43),
  ('nx_t5_3_p1', 'nx_t5_3', 'Enforcer .50 | Serafim Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'fade', 10635.43),
  ('nx_t5_3_p2', 'nx_t5_3', 'Aegis-SSR | Serafim Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'circuit', 11993.14),
  ('nx_t5_3_k1', 'nx_t5_3', 'Phantom-M4 | Serafim Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'damascus', 34200),
  ('nx_t5_3_k2', 'nx_t5_3', 'Valkyrie-47 | Serafim Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'fade', 37800),
  ('nx_t5_3_r1', 'nx_t5_3', 'Titan-AWM | Serafim Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 102600),
  ('nx_t5_3_r2', 'nx_t5_3', 'Omega-Rail | Serafim Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 114480),
  ('nx_t5_3_g1', 'nx_t5_3', '★ Balisong Dual | Serafim Marble Fade', 'gold', 'butterfly', '#0075ff', '#ffd700', 'fade', 331200),
  ('nx_t5_3_g2', 'nx_t5_3', '★ Cyber-Tanto | Serafim Obsidiana', 'gold', 'tanto', '#00e5ff', '#6366f1', 'damascus', 352800),
  ('nx_t5_3_g3', 'nx_t5_3', '★ Adaga Kunai | Serafim Tigre Dourado', 'gold', 'kunai', '#ff9100', '#ffd700', 'tiger', 374400),
  ('nx_t5_3_g4', 'nx_t5_3', '★ Baioneta M-Tática | Serafim Supernova', 'gold', 'bayonet', '#d946ef', '#ffd700', 'doppler', 396000),
  ('nx_t6_1_b1', 'nx_t6_1', 'Kestrel-9 | Ômega Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'doppler', 5374.29),
  ('nx_t6_1_b2', 'nx_t6_1', 'Viper-7 | Ômega Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'fade', 5732.57),
  ('nx_t6_1_b3', 'nx_t6_1', 'Breacher-12 | Ômega Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'circuit', 6210.29),
  ('nx_t6_1_b4', 'nx_t6_1', 'Vector-X | Ômega Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'doppler', 6568.57),
  ('nx_t6_1_p1', 'nx_t6_1', 'Enforcer .50 | Ômega Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'fade', 22452.57),
  ('nx_t6_1_p2', 'nx_t6_1', 'Aegis-SSR | Ômega Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'circuit', 25318.86),
  ('nx_t6_1_k1', 'nx_t6_1', 'Phantom-M4 | Ômega Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'doppler', 72200),
  ('nx_t6_1_k2', 'nx_t6_1', 'Valkyrie-47 | Ômega Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'fade', 79800),
  ('nx_t6_1_r1', 'nx_t6_1', 'Titan-AWM | Ômega Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 216600),
  ('nx_t6_1_r2', 'nx_t6_1', 'Omega-Rail | Ômega Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 241680),
  ('nx_t6_1_g1', 'nx_t6_1', '★ Garra Karambit | Ômega Safira', 'gold', 'karambit', '#0075ff', '#00e5ff', 'doppler', 699200),
  ('nx_t6_1_g2', 'nx_t6_1', '★ Balisong Dual | Ômega Rubi', 'gold', 'butterfly', '#ff1744', '#ff9100', 'doppler', 744800),
  ('nx_t6_1_g3', 'nx_t6_1', '★ Baioneta M-Tática | Ômega Esmeralda', 'gold', 'bayonet', '#00b24b', '#a7f3d0', 'doppler', 790400),
  ('nx_t6_1_g4', 'nx_t6_1', '★ Manoplas Táticas | Ômega Overclock', 'gold', 'gloves', '#8847ff', '#00e5ff', 'circuit', 836000),
  ('nx_t6_2_b1', 'nx_t6_2', 'Kestrel-9 | Soberano Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'fade', 7071.43),
  ('nx_t6_2_b2', 'nx_t6_2', 'Viper-7 | Soberano Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'doppler', 7542.86),
  ('nx_t6_2_b3', 'nx_t6_2', 'Breacher-12 | Soberano Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'damascus', 8171.43),
  ('nx_t6_2_b4', 'nx_t6_2', 'Vector-X | Soberano Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'fade', 8642.86),
  ('nx_t6_2_p1', 'nx_t6_2', 'Enforcer .50 | Soberano Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'doppler', 29542.86),
  ('nx_t6_2_p2', 'nx_t6_2', 'Aegis-SSR | Soberano Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'damascus', 33314.29),
  ('nx_t6_2_k1', 'nx_t6_2', 'Phantom-M4 | Soberano Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'fade', 95000),
  ('nx_t6_2_k2', 'nx_t6_2', 'Valkyrie-47 | Soberano Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'doppler', 105000),
  ('nx_t6_2_r1', 'nx_t6_2', 'Titan-AWM | Soberano Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 285000),
  ('nx_t6_2_r2', 'nx_t6_2', 'Omega-Rail | Soberano Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 318000),
  ('nx_t6_2_g1', 'nx_t6_2', '★ Cyber-Tanto | Soberano Fade Solar', 'gold', 'tanto', '#ff007f', '#ffd700', 'fade', 920000),
  ('nx_t6_2_g2', 'nx_t6_2', '★ Adaga Kunai | Soberano Ametista', 'gold', 'kunai', '#a855f7', '#ec4899', 'doppler', 980000),
  ('nx_t6_2_g3', 'nx_t6_2', '★ Garra Karambit | Soberano Damasco Real', 'gold', 'karambit', '#e2e8f0', '#ffd700', 'damascus', 1040000),
  ('nx_t6_2_g4', 'nx_t6_2', '★ Manoplas Táticas | Soberano Carmesim', 'gold', 'gloves', '#ef4444', '#ffd700', 'hex', 1100000),
  ('nx_t6_3_b1', 'nx_t6_3', 'Kestrel-9 | Singular Malha', 'blue', 'pistol_light', '#3b82f6', '#1d4ed8', 'doppler', 9192.86),
  ('nx_t6_3_b2', 'nx_t6_3', 'Viper-7 | Singular Vetor', 'blue', 'smg_compact', '#0284c7', '#2563eb', 'fade', 9805.71),
  ('nx_t6_3_b3', 'nx_t6_3', 'Breacher-12 | Singular Polímero', 'blue', 'shotgun_tac', '#60a5fa', '#1e40af', 'damascus', 10622.86),
  ('nx_t6_3_b4', 'nx_t6_3', 'Vector-X | Singular Matriz', 'blue', 'pdw_vector', '#38bdf8', '#1d4ed8', 'doppler', 11235.71),
  ('nx_t6_3_p1', 'nx_t6_3', 'Enforcer .50 | Singular Cromo', 'purple', 'pistol_heavy', '#8b5cf6', '#4f46e5', 'fade', 38405.71),
  ('nx_t6_3_p2', 'nx_t6_3', 'Aegis-SSR | Singular Pulso', 'purple', 'rifle_dmr', '#a855f7', '#ec4899', 'damascus', 43308.57),
  ('nx_t6_3_k1', 'nx_t6_3', 'Phantom-M4 | Singular Espectro', 'pink', 'rifle_bullpup', '#d946ef', '#00e5ff', 'doppler', 123500),
  ('nx_t6_3_k2', 'nx_t6_3', 'Valkyrie-47 | Singular Synth', 'pink', 'rifle_heavy', '#f43f5e', '#a855f7', 'fade', 136500),
  ('nx_t6_3_r1', 'nx_t6_3', 'Titan-AWM | Singular Soberano', 'red', 'sniper_bolt', '#ef4444', '#ff9100', 'fade', 370500),
  ('nx_t6_3_r2', 'nx_t6_3', 'Omega-Rail | Singular Quântico', 'red', 'railgun', '#ff1744', '#ffd700', 'doppler', 413400),
  ('nx_t6_3_g1', 'nx_t6_3', '★ Balisong Dual | Singular Marble Fade', 'gold', 'butterfly', '#0075ff', '#ffd700', 'fade', 1196000),
  ('nx_t6_3_g2', 'nx_t6_3', '★ Cyber-Tanto | Singular Obsidiana', 'gold', 'tanto', '#00e5ff', '#6366f1', 'damascus', 1274000),
  ('nx_t6_3_g3', 'nx_t6_3', '★ Adaga Kunai | Singular Tigre Dourado', 'gold', 'kunai', '#ff9100', '#ffd700', 'tiger', 1352000),
  ('nx_t6_3_g4', 'nx_t6_3', '★ Baioneta M-Tática | Singular Supernova', 'gold', 'bayonet', '#d946ef', '#ffd700', 'doppler', 1430000)
ON CONFLICT (template_id) DO UPDATE SET
  case_id = EXCLUDED.case_id, name = EXCLUDED.name, rarity = EXCLUDED.rarity, shape = EXCLUDED.shape,
  c1 = EXCLUDED.c1, c2 = EXCLUDED.c2, pattern = EXCLUDED.pattern, base_price = EXCLUDED.base_price;
-- </catalog-seed>

-- ============================================================================
-- MIGRAÇÃO: CADA PERFIL PERTENCE A UMA CONTA DO SUPABASE AUTH
-- ============================================================================
-- Remove perfis órfãos (sem dono autenticado). Antes do login anônimo qualquer
-- pessoa podia escrever em qualquer linha, então essas linhas não são confiáveis.
DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_id_auth_users_fkey' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_auth_users_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Funções de versões anteriores que confiavam em números enviados pelo cliente
DROP FUNCTION IF EXISTS public.sync_operator_leaderboard_rpc(
  TEXT, TEXT, INT, INT, BIGINT, NUMERIC, NUMERIC, INT, INT, INT, NUMERIC, INT, INT
);
DROP FUNCTION IF EXISTS public.submit_gridshot_rpc(UUID, INT, INT, INT, UUID);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) — ZERO CONFIANÇA NO CLIENTE
-- Nenhuma tabela aceita INSERT/UPDATE/DELETE vindo do cliente: não há policy de escrita.
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gridshot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- O cliente lê apenas o PRÓPRIO perfil; o ranking público sai da view abaixo
DROP POLICY IF EXISTS "Leitura publica de perfis para Ranking" ON public.profiles;
DROP POLICY IF EXISTS "Leitura do proprio perfil" ON public.profiles;
CREATE POLICY "Leitura do proprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Leitura do proprio inventario" ON public.inventory_items;
CREATE POLICY "Leitura do proprio inventario"
  ON public.inventory_items FOR SELECT
  USING (auth.uid() = user_id);

-- Ranking Global: só as colunas públicas (sem saldo, sem datas de VIP, sem ID interno)
DROP VIEW IF EXISTS public.leaderboard_global_view;
CREATE VIEW public.leaderboard_global_view AS
SELECT
  p.player_id,
  p.callsign,
  p.prestige_level,
  p.mil_level,
  p.xp,
  p.net_worth,
  p.passive_rate_per_sec,
  p.unique_skins_count,
  p.platinum_cases_count,
  p.best_gridshot_score,
  p.best_drop_value,
  p.golds_unboxed,
  p.cases_opened,
  COALESCE(p.vip_until > now(), FALSE) AS is_vip,
  p.updated_at
FROM public.profiles p;

-- PRIVILÉGIOS DE TABELA
-- O Supabase concede ALL em toda tabela/view nova de `public` para anon e authenticated.
-- Nas tabelas o RLS segura, mas a view é atualizável e roda com os privilégios do dono (que
-- ignora o RLS): sem este REVOKE, um UPDATE na view reescreveria o perfil de qualquer jogador.
REVOKE ALL ON public.leaderboard_global_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard_global_view TO anon, authenticated;

REVOKE ALL ON
  public.profiles, public.inventory_items, public.gridshot_sessions, public.payment_ledger,
  public.case_catalog, public.item_catalog, public.app_settings
FROM PUBLIC, anon, authenticated;
-- Leitura direta só do que é do próprio jogador (as policies acima filtram as linhas)
GRANT SELECT ON public.profiles, public.inventory_items TO authenticated;

-- ============================================================================
-- FUNÇÕES INTERNAS (não são chamáveis pelo cliente — ver PERMISSÕES no fim)
-- search_path inclui `extensions`: é onde o Supabase instala pgcrypto/citext.
-- ============================================================================

-- Número aleatório uniforme em [0, 1) vindo do CSPRNG do pgcrypto
CREATE OR REPLACE FUNCTION public._rand()
RETURNS DOUBLE PRECISION
LANGUAGE sql
VOLATILE
SET search_path = public, extensions
AS $$
  SELECT (('x' || encode(gen_random_bytes(6), 'hex'))::bit(48)::bigint)::double precision / 281474976710656.0
$$;

-- Patente Militar (1–55) a partir do XP total — mesma curva do cliente
CREATE OR REPLACE FUNCTION public._mil_level(p_xp BIGINT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rem BIGINT := GREATEST(0, COALESCE(p_xp, 0));
  v_lvl INT := 1;
  v_need BIGINT;
BEGIN
  WHILE v_lvl < 55 LOOP
    v_need := round(140 + power(v_lvl::double precision, 1.55) * 28);
    EXIT WHEN v_rem < v_need;
    v_rem := v_rem - v_need;
    v_lvl := v_lvl + 1;
  END LOOP;
  RETURN v_lvl;
END;
$$;

CREATE OR REPLACE FUNCTION public._wear_short(p_float NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_float < 0.07 THEN 'FN'
    WHEN p_float < 0.15 THEN 'MW'
    WHEN p_float < 0.38 THEN 'FT'
    WHEN p_float < 0.45 THEN 'WW'
    ELSE 'BS'
  END
$$;

CREATE OR REPLACE FUNCTION public._wear_mult(p_float NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_float < 0.07 THEN 1.45
    WHEN p_float < 0.15 THEN 1.20
    WHEN p_float < 0.38 THEN 1.00
    WHEN p_float < 0.45 THEN 0.85
    ELSE 0.72
  END
$$;

-- Lê um número de um JSON sem estourar erro quando o campo veio com lixo
CREATE OR REPLACE FUNCTION public._jnum(p_obj JSONB, p_key TEXT, p_default NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN jsonb_typeof(p_obj -> p_key) = 'number' THEN (p_obj ->> p_key)::numeric ELSE p_default END
$$;

CREATE OR REPLACE FUNCTION public._ensure_profile(p_uid UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  INSERT INTO public.profiles (id, player_id)
  VALUES (p_uid, p_uid::text)
  ON CONFLICT (id) DO NOTHING
$$;

CREATE OR REPLACE FUNCTION public._item_json(i public.inventory_items)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'uid', i.uid,
    'template_id', i.template_id,
    'case_id', i.case_id,
    'float', i.float_val,
    'wear_short', i.wear_short,
    'stat_trak', i.stat_trak,
    'kills', i.kills,
    'is_heirloom', i.is_heirloom,
    'price', i.price,
    'obtained_at_ms', round(extract(epoch FROM i.obtained_at) * 1000)
  )
$$;

CREATE OR REPLACE FUNCTION public._inventory_json(p_uid UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(jsonb_agg(public._item_json(i) ORDER BY i.obtained_at, i.uid), '[]'::jsonb)
  FROM public.inventory_items i
  WHERE i.user_id = p_uid
$$;

CREATE OR REPLACE FUNCTION public._profile_json(p_uid UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'player_id', p.player_id,
    'callsign', p.callsign::text,
    'callsign_locked', p.callsign_locked,
    'balance', p.balance,
    'passive_rate_per_sec', p.passive_rate_per_sec,
    'offline_cap_sec', CASE WHEN p.vip_until IS NOT NULL AND p.vip_until > now() THEN 86400 ELSE 43200 END,
    'is_vip', COALESCE(p.vip_until > now(), FALSE),
    'vip_until', p.vip_until,
    'prestige_level', p.prestige_level,
    'xp', p.xp,
    'mil_level', p.mil_level,
    'unique_skins_count', p.unique_skins_count,
    'platinum_cases_count', p.platinum_cases_count,
    'net_worth', p.net_worth,
    'cases_opened', p.cases_opened,
    'golds_unboxed', p.golds_unboxed,
    'tradeups_done', p.tradeups_done,
    'best_drop_value', p.best_drop_value,
    'best_gridshot_score', p.best_gridshot_score,
    'total_spent', p.total_spent,
    'total_earned', p.total_earned,
    'targets_hit', p.targets_hit,
    'gridshot_cooldown_ms', GREATEST(0, round(extract(epoch FROM (p.next_gridshot_allowed_at - now())) * 1000))
  )
  FROM public.profiles p
  WHERE p.id = p_uid
$$;

CREATE OR REPLACE FUNCTION public._state_json(p_uid UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'profile', public._profile_json(p_uid),
    'inventory', public._inventory_json(p_uid)
  )
$$;

-- Sincronização Lazy de Renda Passiva (usa o relógio oficial do servidor PostgreSQL).
-- É a PRIMEIRA linha de toda transação que mexe em saldo ou inventário: credita o que
-- rendeu até agora com a taxa antiga, antes de a taxa mudar.
CREATE OR REPLACE FUNCTION public.sync_lazy_idle_income(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_max_offline_sec NUMERIC;
  v_elapsed_sec NUMERIC;
  v_earned NUMERIC;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Operadores VIP têm limite offline de 24h (86400s); padrão tem 12h (43200s)
  v_max_offline_sec := CASE WHEN v_profile.vip_until IS NOT NULL AND v_profile.vip_until > now() THEN 86400 ELSE 43200 END;
  v_elapsed_sec := LEAST(v_max_offline_sec, GREATEST(0, EXTRACT(EPOCH FROM (now() - v_profile.last_claimed_at))));

  IF v_elapsed_sec <= 0 THEN
    RETURN v_profile.balance;
  END IF;

  v_earned := ROUND((v_elapsed_sec * v_profile.passive_rate_per_sec)::numeric, 2);

  UPDATE public.profiles
  SET balance = LEAST(99999999999999.99, balance + v_earned),
      last_claimed_at = now(),
      updated_at = now()
  WHERE id = p_user_id
  RETURNING balance INTO v_profile.balance;

  RETURN v_profile.balance;
END;
$$;

-- Recalcula tudo que deriva do inventário: skins únicas, caixas platinadas, renda $/s,
-- patrimônio e patente. Mesmas fórmulas que o cliente usa para exibir.
CREATE OR REPLACE FUNCTION public._recompute_profile(p_uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prof public.profiles%ROWTYPE;
  v_kept INT;
  v_skins_rate NUMERIC;
  v_inv_value NUMERIC;
  v_any_stage1 BOOLEAN;
  v_plat INT;
  v_bonus_pct INT := 0;
  v_rate NUMERIC;
BEGIN
  SELECT * INTO v_prof FROM public.profiles WHERE id = p_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  WITH owned AS (
    SELECT DISTINCT template_id FROM public.inventory_items WHERE user_id = p_uid
  ),
  case_counts AS (
    SELECT
      c.case_id,
      count(*) FILTER (WHERE c.rarity <> 'gold') AS w_total,
      count(*) FILTER (WHERE c.rarity = 'gold') AS g_total,
      count(o.template_id) FILTER (WHERE c.rarity <> 'gold') AS w_owned,
      count(o.template_id) FILTER (WHERE c.rarity = 'gold') AS g_owned
    FROM public.item_catalog c
    LEFT JOIN owned o ON o.template_id = c.template_id
    GROUP BY c.case_id
  ),
  -- Maestria da caixa: 1 = todas as armas (+25% $/s), 2 = armas + 4 ★ Apex (+100% $/s)
  case_mastery AS (
    SELECT
      case_id,
      CASE
        WHEN w_total > 0 AND w_owned = w_total AND g_total > 0 AND g_owned = g_total THEN 2
        WHEN w_total > 0 AND w_owned = w_total THEN 1
        ELSE 0
      END AS stage
    FROM case_counts
  ),
  -- "Titulares": a melhor cópia de cada skin (Herança primeiro, depois a mais valiosa)
  -- mais toda cópia extra protegida por Herança. Só titulares geram renda.
  ranked AS (
    SELECT
      i.case_id,
      i.price,
      i.is_heirloom,
      row_number() OVER (
        PARTITION BY i.template_id
        ORDER BY i.is_heirloom DESC, i.price DESC, i.obtained_at, i.uid
      ) AS rn
    FROM public.inventory_items i
    WHERE i.user_id = p_uid
  ),
  kept AS (
    SELECT r.case_id, r.price FROM ranked r WHERE r.rn = 1 OR r.is_heirloom
  )
  SELECT
    (SELECT count(*) FROM kept),
    (
      SELECT COALESCE(sum(round(
        GREATEST(0.005, k.price * 0.0004)
        * (CASE COALESCE(m.stage, 0) WHEN 2 THEN 2.0 WHEN 1 THEN 1.25 ELSE 1.0 END), 3)), 0)
      FROM kept k
      LEFT JOIN case_mastery m ON m.case_id = k.case_id
    ),
    (SELECT COALESCE(sum(price), 0) FROM public.inventory_items WHERE user_id = p_uid),
    (SELECT COALESCE(bool_or(stage >= 1), FALSE) FROM case_mastery),
    (SELECT count(*) FROM case_mastery WHERE stage = 2)
  INTO v_kept, v_skins_rate, v_inv_value, v_any_stage1, v_plat;

  -- Conquistas (bônus global de $/s)
  IF v_prof.cases_opened >= 10 THEN v_bonus_pct := v_bonus_pct + 5; END IF;
  IF v_kept >= 25 THEN v_bonus_pct := v_bonus_pct + 10; END IF;
  IF v_prof.tradeups_done >= 1 THEN v_bonus_pct := v_bonus_pct + 10; END IF;
  IF v_prof.golds_unboxed >= 1 THEN v_bonus_pct := v_bonus_pct + 15; END IF;
  IF v_any_stage1 THEN v_bonus_pct := v_bonus_pct + 15; END IF;
  IF v_plat >= 1 THEN v_bonus_pct := v_bonus_pct + 25; END IF;

  v_rate := round((0.15 + v_skins_rate) * (1 + v_bonus_pct / 100.0) * (1 + v_prof.prestige_level * 0.5), 2);

  UPDATE public.profiles
  SET unique_skins_count = v_kept,
      platinum_cases_count = v_plat,
      passive_rate_per_sec = LEAST(9999999999.9999, v_rate),
      net_worth = LEAST(99999999999999.99, balance + v_inv_value),
      mil_level = public._mil_level(xp),
      updated_at = now()
  WHERE id = p_uid;
END;
$$;

-- Sorteia e entrega UM item de uma caixa (raridade livre ou forçada pelo contrato de troca)
CREATE OR REPLACE FUNCTION public._grant_item(
  p_uid UUID,
  p_case_id TEXT,
  p_forced_rarity TEXT,
  p_sync_chance NUMERIC
)
RETURNS public.inventory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_roll DOUBLE PRECISION;
  v_rarity TEXT := p_forced_rarity;
  v_tpl public.item_catalog%ROWTYPE;
  v_float NUMERIC(6, 5);
  v_stat_trak BOOLEAN;
  v_item public.inventory_items%ROWTYPE;
BEGIN
  IF v_rarity IS NULL THEN
    -- Probabilidades publicadas na interface: 75% / 16% / 5.5% / 2.5% / 1%
    v_roll := public._rand() * 100;
    v_rarity := CASE
      WHEN v_roll < 75.0 THEN 'blue'
      WHEN v_roll < 91.0 THEN 'purple'
      WHEN v_roll < 96.5 THEN 'pink'
      WHEN v_roll < 99.0 THEN 'red'
      ELSE 'gold'
    END;
  END IF;

  SELECT * INTO v_tpl
  FROM public.item_catalog
  WHERE case_id = p_case_id AND rarity = v_rarity
  ORDER BY public._rand()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_CASE: a caixa "%" não tem itens de raridade "%".', p_case_id, v_rarity;
  END IF;

  v_float := round((public._rand() * 0.999 + 0.0001)::numeric, 5);
  v_stat_trak := public._rand() < p_sync_chance;

  INSERT INTO public.inventory_items (
    user_id, template_id, case_id, name, rarity, shape, c1, c2, pattern,
    float_val, wear_short, stat_trak, price
  ) VALUES (
    p_uid, v_tpl.template_id, v_tpl.case_id, v_tpl.name, v_tpl.rarity, v_tpl.shape, v_tpl.c1, v_tpl.c2, v_tpl.pattern,
    v_float,
    public._wear_short(v_float),
    v_stat_trak,
    round(v_tpl.base_price * public._wear_mult(v_float) * (CASE WHEN v_stat_trak THEN 1.85 ELSE 1 END), 2)
  )
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- ============================================================================
-- RPCs DO JOGO (SECURITY DEFINER) — TODA A ECONOMIA RODA AQUI
-- ============================================================================

-- A) Estado completo do operador (perfil + inventário) com a renda offline já creditada
CREATE OR REPLACE FUNCTION public.get_my_state_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_after NUMERIC;
  v_cap NUMERIC;
  v_import_until TIMESTAMPTZ;
  v_import_open BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  v_cap := CASE WHEN v_prof.vip_until IS NOT NULL AND v_prof.vip_until > now() THEN 86400 ELSE 43200 END;

  v_after := public.sync_lazy_idle_income(v_uid);
  PERFORM public._recompute_profile(v_uid);

  SELECT value::timestamptz INTO v_import_until FROM public.app_settings WHERE key = 'legacy_import_until';
  v_import_open := v_import_until IS NOT NULL
    AND now() < v_import_until
    AND NOT v_prof.legacy_imported
    AND v_prof.cases_opened = 0
    AND NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE user_id = v_uid);

  RETURN public._state_json(v_uid) || jsonb_build_object(
    'offline', jsonb_build_object(
      'elapsed_sec', floor(LEAST(v_cap, GREATEST(0, EXTRACT(EPOCH FROM (now() - v_prof.last_claimed_at))))),
      'earned', v_after - v_prof.balance
    ),
    'legacy_import_open', v_import_open
  );
END;
$$;

-- B) Abrir caixas: o servidor debita, sorteia (CSPRNG) e entrega os itens
CREATE OR REPLACE FUNCTION public.open_case_rpc(p_case_id TEXT, p_count INT DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_case public.case_catalog%ROWTYPE;
  v_total NUMERIC;
  v_item public.inventory_items%ROWTYPE;
  v_items JSONB := '[]'::jsonb;
  v_xp NUMERIC := 0;
  v_golds INT := 0;
  v_best NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;
  IF p_count IS NULL OR p_count NOT IN (1, 2, 3, 5) THEN
    RAISE EXCEPTION 'INVALID_COUNT: a abertura múltipla aceita 1, 2, 3 ou 5 caixas.';
  END IF;

  SELECT * INTO v_case FROM public.case_catalog WHERE id = p_case_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_CASE: caixa "%" não existe.', p_case_id;
  END IF;

  PERFORM public._ensure_profile(v_uid);
  PERFORM public.sync_lazy_idle_income(v_uid);
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;

  -- Desconto de Prestígio: -1% por nível
  v_total := round(round(v_case.price * (1 - v_prof.prestige_level * 0.01), 2) * p_count, 2);
  IF v_prof.balance < v_total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: saldo insuficiente para abrir %x.', p_count;
  END IF;

  FOR n IN 1..p_count LOOP
    -- Chance de SyncTrack™: 10% + 1% por nível de Prestígio
    v_item := public._grant_item(v_uid, v_case.id, NULL, 0.10 + v_prof.prestige_level * 0.01);
    v_items := v_items || jsonb_build_array(public._item_json(v_item));
    v_xp := v_xp + (CASE v_item.rarity
      WHEN 'blue' THEN 25 WHEN 'purple' THEN 60 WHEN 'pink' THEN 150 WHEN 'red' THEN 400 ELSE 1200
    END) * (1 + (v_case.tier - 1) * 0.35);
    IF v_item.rarity = 'gold' THEN v_golds := v_golds + 1; END IF;
    v_best := GREATEST(v_best, v_item.price);
  END LOOP;

  UPDATE public.profiles
  SET balance = balance - v_total,
      total_spent = total_spent + v_total,
      cases_opened = cases_opened + p_count,
      golds_unboxed = golds_unboxed + v_golds,
      best_drop_value = GREATEST(best_drop_value, v_best),
      -- VIP: +25% de XP Militar
      xp = xp + round(v_xp * (CASE WHEN vip_until IS NOT NULL AND vip_until > now() THEN 1.25 ELSE 1 END))
  WHERE id = v_uid;

  PERFORM public._recompute_profile(v_uid);

  RETURN jsonb_build_object('items', v_items, 'profile', public._profile_json(v_uid));
END;
$$;

-- C) Vender itens escolhidos (itens com Herança não são vendidos)
CREATE OR REPLACE FUNCTION public.sell_items_rpc(p_uids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_removed UUID[];
  v_gain NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  PERFORM public.sync_lazy_idle_income(v_uid);

  WITH sold AS (
    DELETE FROM public.inventory_items
    WHERE user_id = v_uid AND uid = ANY(COALESCE(p_uids, '{}'::uuid[])) AND NOT is_heirloom
    RETURNING uid, price
  )
  SELECT COALESCE(array_agg(uid), '{}'::uuid[]), COALESCE(sum(price), 0) INTO v_removed, v_gain FROM sold;

  UPDATE public.profiles
  SET balance = LEAST(99999999999999.99, balance + v_gain),
      total_earned = total_earned + v_gain
  WHERE id = v_uid;

  PERFORM public._recompute_profile(v_uid);

  RETURN jsonb_build_object('removed', to_jsonb(v_removed), 'gained', v_gain, 'profile', public._profile_json(v_uid));
END;
$$;

-- D) Vender todas as duplicadas (mantém a melhor cópia de cada skin e toda Herança)
CREATE OR REPLACE FUNCTION public.sell_duplicates_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_removed UUID[];
  v_gain NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  PERFORM public.sync_lazy_idle_income(v_uid);

  WITH ranked AS (
    SELECT
      i.uid,
      i.is_heirloom,
      row_number() OVER (
        PARTITION BY i.template_id
        ORDER BY i.is_heirloom DESC, i.price DESC, i.obtained_at, i.uid
      ) AS rn
    FROM public.inventory_items i
    WHERE i.user_id = v_uid
  ),
  sold AS (
    DELETE FROM public.inventory_items d
    USING ranked r
    WHERE d.uid = r.uid AND r.rn > 1 AND NOT r.is_heirloom
    RETURNING d.uid, d.price
  )
  SELECT COALESCE(array_agg(uid), '{}'::uuid[]), COALESCE(sum(price), 0) INTO v_removed, v_gain FROM sold;

  UPDATE public.profiles
  SET balance = LEAST(99999999999999.99, balance + v_gain),
      total_earned = total_earned + v_gain
  WHERE id = v_uid;

  PERFORM public._recompute_profile(v_uid);

  RETURN jsonb_build_object('removed', to_jsonb(v_removed), 'gained', v_gain, 'profile', public._profile_json(v_uid));
END;
$$;

-- E) Contrato de Troca: 5 itens da mesma raridade -> 1 item da raridade seguinte.
--    O item forjado sai da caixa de UM DOS 5 ITENS consumidos (sorteado), e não de uma
--    caixa escolhida pelo cliente — senão 5 itens baratos virariam um item da caixa mais cara.
CREATE OR REPLACE FUNCTION public.execute_tradeup_rpc(p_uids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_count INT;
  v_rarities INT;
  v_rarity TEXT;
  v_next TEXT;
  v_case_id TEXT;
  v_item public.inventory_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;
  IF p_uids IS NULL OR cardinality(p_uids) <> 5
     OR (SELECT count(DISTINCT u) FROM unnest(p_uids) AS u) <> 5 THEN
    RAISE EXCEPTION 'TRADEUP_INVALID: o contrato exige exatamente 5 itens diferentes.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  PERFORM public.sync_lazy_idle_income(v_uid);
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;

  SELECT count(*), count(DISTINCT rarity), min(rarity)
  INTO v_count, v_rarities, v_rarity
  FROM public.inventory_items
  WHERE user_id = v_uid AND uid = ANY(p_uids) AND NOT is_heirloom;

  IF v_count <> 5 OR v_rarities <> 1 THEN
    RAISE EXCEPTION 'TRADEUP_INVALID: os 5 itens precisam ser seus, da mesma raridade e sem Herança.';
  END IF;

  v_next := CASE v_rarity WHEN 'blue' THEN 'purple' WHEN 'purple' THEN 'pink' WHEN 'pink' THEN 'red' WHEN 'red' THEN 'gold' END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'TRADEUP_INVALID: itens ★ Apex não podem ser forjados.';
  END IF;

  SELECT case_id INTO v_case_id
  FROM public.inventory_items
  WHERE user_id = v_uid AND uid = ANY(p_uids)
  ORDER BY public._rand()
  LIMIT 1;

  DELETE FROM public.inventory_items WHERE user_id = v_uid AND uid = ANY(p_uids);

  v_item := public._grant_item(v_uid, v_case_id, v_next, 0.10 + v_prof.prestige_level * 0.01);

  UPDATE public.profiles
  SET tradeups_done = tradeups_done + 1,
      xp = xp + round(180 * (CASE WHEN vip_until IS NOT NULL AND vip_until > now() THEN 1.25 ELSE 1 END))
  WHERE id = v_uid;

  PERFORM public._recompute_profile(v_uid);

  RETURN jsonb_build_object(
    'removed', to_jsonb(p_uids),
    'items', jsonb_build_array(public._item_json(v_item)),
    'profile', public._profile_json(v_uid)
  );
END;
$$;

-- F) Token de Herança Permanente (protege a skin do reset de Prestígio)
CREATE OR REPLACE FUNCTION public.set_heirloom_rpc(p_uid UUID, p_locked BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_item public.inventory_items%ROWTYPE;
  v_max INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  PERFORM public.sync_lazy_idle_income(v_uid);
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;

  SELECT * INTO v_item FROM public.inventory_items WHERE uid = p_uid AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND: este item não está no seu inventário.';
  END IF;

  IF COALESCE(p_locked, FALSE) AND NOT v_item.is_heirloom THEN
    v_max := LEAST(10, v_prof.prestige_level + 1);
    IF (SELECT count(*) FROM public.inventory_items WHERE user_id = v_uid AND is_heirloom) >= v_max THEN
      RAISE EXCEPTION 'HEIRLOOM_LIMIT: limite de Herança Permanente atingido (%/%).', v_max, v_max;
    END IF;
  END IF;

  UPDATE public.inventory_items
  SET is_heirloom = COALESCE(p_locked, FALSE)
  WHERE uid = p_uid
  RETURNING * INTO v_item;

  PERFORM public._recompute_profile(v_uid);

  RETURN jsonb_build_object(
    'updated', jsonb_build_array(public._item_json(v_item)),
    'profile', public._profile_json(v_uid)
  );
END;
$$;

-- G) Prestígio: valida os 3 requisitos no servidor e aplica o reset
CREATE OR REPLACE FUNCTION public.prestige_up_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_next INT;
  v_req_skins INT;
  v_req_plats INT;
  v_max_heirlooms INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  PERFORM public.sync_lazy_idle_income(v_uid);
  PERFORM public._recompute_profile(v_uid);
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;

  IF v_prof.prestige_level >= 10 THEN
    RAISE EXCEPTION 'PRESTIGE_MAX: Prestígio X já é o nível máximo.';
  END IF;

  v_next := v_prof.prestige_level + 1;
  v_req_skins := (ARRAY[90, 110, 130, 150, 170, 185, 200, 215, 230, 245])[v_next];
  v_req_plats := (ARRAY[2, 3, 5, 7, 9, 11, 13, 15, 16, 18])[v_next];

  IF public._mil_level(v_prof.xp) < 55
     OR v_prof.unique_skins_count < v_req_skins
     OR v_prof.platinum_cases_count < v_req_plats THEN
    RAISE EXCEPTION 'PRESTIGE_REQUIREMENTS: requisitos do Prestígio % não cumpridos (Nv. 55, % skins únicas, % caixas platinadas).',
      v_next, v_req_skins, v_req_plats;
  END IF;

  -- Slots de Herança do nível ATUAL. Se nada foi protegido, as skins mais valiosas são mantidas.
  v_max_heirlooms := LEAST(10, v_prof.prestige_level + 1);
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE user_id = v_uid AND is_heirloom) THEN
    UPDATE public.inventory_items
    SET is_heirloom = TRUE
    WHERE uid IN (
      SELECT uid FROM public.inventory_items
      WHERE user_id = v_uid
      ORDER BY price DESC, obtained_at, uid
      LIMIT v_max_heirlooms
    );
  END IF;

  DELETE FROM public.inventory_items
  WHERE user_id = v_uid
    AND uid NOT IN (
      SELECT uid FROM public.inventory_items
      WHERE user_id = v_uid AND is_heirloom
      ORDER BY price DESC, obtained_at, uid
      LIMIT v_max_heirlooms
    );

  UPDATE public.profiles
  SET prestige_level = v_next,
      xp = 0,
      balance = 500 + v_next * 1000
  WHERE id = v_uid;

  PERFORM public._recompute_profile(v_uid);

  RETURN public._state_json(v_uid);
END;
$$;

-- H) Registro Único e Permanente de Callsign
CREATE OR REPLACE FUNCTION public.register_unique_callsign_rpc(p_callsign TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean TEXT := btrim(COALESCE(p_callsign, ''));
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  IF char_length(v_clean) < 3 OR char_length(v_clean) > 18 THEN
    RAISE EXCEPTION 'CALLSIGN_INVALID: o Callsign deve ter entre 3 e 18 caracteres.';
  END IF;

  IF lower(v_clean) LIKE 'operador-%' THEN
    RAISE EXCEPTION 'CALLSIGN_INVALID: escolha um Callsign personalizado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;

  IF v_profile.callsign IS NOT NULL THEN
    RAISE EXCEPTION 'CALLSIGN_LOCKED: seu Callsign já está travado permanentemente como "%".', v_profile.callsign;
  END IF;

  -- O cast para CITEXT é obrigatório: citext = text cairia na comparação case-sensitive
  IF EXISTS (SELECT 1 FROM public.profiles WHERE callsign = v_clean::citext AND id <> v_uid) THEN
    RAISE EXCEPTION 'CALLSIGN_TAKEN: O Callsign "%" já pertence a outro operador!', v_clean;
  END IF;

  BEGIN
    UPDATE public.profiles
    SET callsign = v_clean,
        callsign_locked = TRUE,
        updated_at = now()
    WHERE id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    -- Dois operadores registraram o mesmo Callsign no mesmo instante: o índice UNIQUE decide
    RAISE EXCEPTION 'CALLSIGN_TAKEN: O Callsign "%" já pertence a outro operador!', v_clean;
  END;

  RETURN jsonb_build_object('ok', true, 'callsign', v_clean, 'profile', public._profile_json(v_uid));
END;
$$;

-- I) Iniciar Sessão Assinada do Gridshot 30s
CREATE OR REPLACE FUNCTION public.start_gridshot_rpc()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_next_allowed TIMESTAMPTZ;
  v_session_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);

  SELECT next_gridshot_allowed_at INTO v_next_allowed
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF v_next_allowed IS NOT NULL AND now() < v_next_allowed THEN
    RAISE EXCEPTION 'GRIDSHOT_COOLDOWN: estande em recarga. Aguarde alguns segundos.';
  END IF;

  -- Só existe UMA rodada aberta por operador (impede abrir várias sessões em paralelo)
  DELETE FROM public.gridshot_sessions
  WHERE user_id = v_uid AND completed_at IS NULL;

  INSERT INTO public.gridshot_sessions (user_id, started_at)
  VALUES (v_uid, now())
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

-- J) Validar e Finalizar Rodada do Gridshot 30s (Anti-Macro & Anti-Speedhack)
CREATE OR REPLACE FUNCTION public.submit_gridshot_rpc(
  p_session_id UUID,
  p_score INT,
  p_hits INT,
  p_shots INT,
  p_crits INT DEFAULT 0,
  p_equipped_uid UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sess public.gridshot_sessions%ROWTYPE;
  v_prof public.profiles%ROWTYPE;
  v_elapsed NUMERIC;
  v_crits INT := COALESCE(p_crits, 0);
  v_weapon_mult NUMERIC := 1.00;
  v_item public.inventory_items%ROWTYPE;
  v_updated JSONB := '[]'::jsonb;
  v_seconds_equiv NUMERIC := 0;
  v_min_floor NUMERIC := 0;
  v_reward NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  SELECT * INTO v_sess
  FROM public.gridshot_sessions
  WHERE id = p_session_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND OR v_sess.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'GRIDSHOT_INVALID_SESSION: sessão de treino inválida ou já finalizada.';
  END IF;

  -- 1. Tempo real decorrido no relógio do servidor: entre 28s e 40s.
  --    RETURN (e não RAISE) para que a marcação de trapaça não sofra rollback.
  v_elapsed := EXTRACT(EPOCH FROM (now() - v_sess.started_at));
  IF v_elapsed < 28 OR v_elapsed > 40 THEN
    UPDATE public.gridshot_sessions SET flagged_cheat = TRUE, completed_at = now() WHERE id = p_session_id;
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SESSION_TIME', 'elapsed', round(v_elapsed, 1));
  END IF;

  -- 2. Teto físico humano: 135 acertos em 30s (4.5 alvos/s). Cada acerto vale no máximo
  --    100 pts (150 se for bullseye) x 2.0 de combo.
  IF p_hits IS NULL OR p_score IS NULL OR p_hits < 0 OR p_hits > 135
     OR v_crits < 0 OR v_crits > p_hits
     OR COALESCE(p_shots, p_hits) < p_hits
     OR p_score < 0
     OR p_score > ((p_hits - v_crits) * 100 + v_crits * 150) * 2 THEN
    UPDATE public.gridshot_sessions SET flagged_cheat = TRUE, completed_at = now() WHERE id = p_session_id;
    RETURN jsonb_build_object('ok', false, 'error', 'TELEMETRY_ANOMALY');
  END IF;

  PERFORM public.sync_lazy_idle_income(v_uid);
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;

  -- 3. Arma equipada: conferida no inventário oficial; SyncTrack™ ganha os abates
  IF p_equipped_uid IS NOT NULL THEN
    SELECT * INTO v_item FROM public.inventory_items WHERE uid = p_equipped_uid AND user_id = v_uid FOR UPDATE;
    IF FOUND THEN
      v_weapon_mult := CASE v_item.rarity
        WHEN 'blue' THEN 1.10
        WHEN 'purple' THEN 1.25
        WHEN 'pink' THEN 1.45
        WHEN 'red' THEN 1.75
        WHEN 'gold' THEN 2.20
        ELSE 1.00
      END;
      IF v_item.stat_trak THEN
        v_weapon_mult := ROUND((v_weapon_mult * 1.15)::numeric, 2);
        UPDATE public.inventory_items SET kills = kills + p_hits WHERE uid = v_item.uid RETURNING * INTO v_item;
        v_updated := jsonb_build_array(public._item_json(v_item));
      END IF;
    END IF;
  END IF;

  -- 4. Recompensa por Rank (S, A, B, C)
  IF p_score >= 6000 THEN
    v_seconds_equiv := 22; v_min_floor := 35;
  ELSIF p_score >= 4000 THEN
    v_seconds_equiv := 15; v_min_floor := 25;
  ELSIF p_score >= 2000 THEN
    v_seconds_equiv := 9;  v_min_floor := 15;
  ELSIF p_score > 0 THEN
    v_seconds_equiv := 4 * (p_score::numeric / 2000.0);
    v_min_floor := round(5 * (p_score::numeric / 2000.0), 2);
  END IF;

  IF p_score > 0 THEN
    v_reward := ROUND((GREATEST(v_min_floor, v_prof.passive_rate_per_sec * v_seconds_equiv) * v_weapon_mult)::numeric, 2);
  END IF;

  UPDATE public.gridshot_sessions
  SET completed_at = now(),
      score = p_score,
      hits = p_hits,
      shots = p_shots,
      reward_paid = v_reward
  WHERE id = p_session_id;

  UPDATE public.profiles
  SET balance = LEAST(99999999999999.99, balance + v_reward),
      total_earned = total_earned + v_reward,
      targets_hit = targets_hit + p_hits,
      -- 2 XP por acerto, 4 por bullseye; VIP: +25%
      xp = xp + round(((p_hits - v_crits) * 2 + v_crits * 4)
                      * (CASE WHEN vip_until IS NOT NULL AND vip_until > now() THEN 1.25 ELSE 1 END)),
      best_gridshot_score = GREATEST(best_gridshot_score, p_score),
      -- 12s no servidor (o cliente espera 15s): a folga absorve a latência de rede
      next_gridshot_allowed_at = now() + interval '12 seconds'
  WHERE id = v_uid;

  PERFORM public._recompute_profile(v_uid);

  RETURN jsonb_build_object(
    'ok', true,
    'reward', v_reward,
    'best_gridshot_score', GREATEST(v_prof.best_gridshot_score, p_score),
    'updated', v_updated,
    'profile', public._profile_json(v_uid)
  );
END;
$$;

-- K) Resetar o progresso da própria conta (o Callsign e o VIP continuam)
CREATE OR REPLACE FUNCTION public.reset_progress_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  DELETE FROM public.inventory_items WHERE user_id = v_uid;
  DELETE FROM public.gridshot_sessions WHERE user_id = v_uid;

  UPDATE public.profiles
  SET balance = 500,
      last_claimed_at = now(),
      prestige_level = 0,
      xp = 0,
      cases_opened = 0,
      golds_unboxed = 0,
      tradeups_done = 0,
      best_drop_value = 0,
      best_gridshot_score = 0,
      total_spent = 0,
      total_earned = 0,
      targets_hit = 0,
      -- O reset não reabre a importação do save antigo
      legacy_imported = TRUE
  WHERE id = v_uid;

  PERFORM public._recompute_profile(v_uid);

  RETURN public._state_json(v_uid);
END;
$$;

-- L) Importar o save antigo do navegador — uma vez por conta, só em perfil zerado e só
--    enquanto a janela `legacy_import_until` estiver aberta. Os itens precisam existir no
--    catálogo e os PREÇOS SÃO RECALCULADOS pelo servidor; o recorde do Gridshot não entra.
CREATE OR REPLACE FUNCTION public.import_legacy_save_rpc(p_save JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_until TIMESTAMPTZ;
  v_items JSONB;
  v_prestige INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: operador não autenticado.';
  END IF;

  PERFORM public._ensure_profile(v_uid);
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  SELECT value::timestamptz INTO v_until FROM public.app_settings WHERE key = 'legacy_import_until';

  IF v_until IS NULL OR now() >= v_until THEN
    RAISE EXCEPTION 'IMPORT_CLOSED: a janela de importação de saves antigos está fechada.';
  END IF;
  IF v_prof.legacy_imported OR v_prof.cases_opened > 0
     OR EXISTS (SELECT 1 FROM public.inventory_items WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'IMPORT_NOT_ALLOWED: esta conta já tem progresso no servidor.';
  END IF;

  v_items := CASE WHEN jsonb_typeof(p_save -> 'inventory') = 'array' THEN p_save -> 'inventory' ELSE '[]'::jsonb END;
  IF jsonb_array_length(v_items) > 3000 THEN
    RAISE EXCEPTION 'IMPORT_TOO_LARGE: inventário grande demais para importar.';
  END IF;

  v_prestige := LEAST(10, GREATEST(0, floor(public._jnum(p_save, 'prestige_level', 0))))::int;

  INSERT INTO public.inventory_items (
    user_id, template_id, case_id, name, rarity, shape, c1, c2, pattern,
    float_val, wear_short, stat_trak, kills, is_heirloom, price
  )
  SELECT
    v_uid, c.template_id, c.case_id, c.name, c.rarity, c.shape, c.c1, c.c2, c.pattern,
    f.fv,
    public._wear_short(f.fv),
    f.st,
    f.kills,
    f.heirloom,
    round(c.base_price * public._wear_mult(f.fv) * (CASE WHEN f.st THEN 1.85 ELSE 1 END), 2)
  FROM jsonb_array_elements(v_items) AS e(j)
  JOIN public.item_catalog c ON c.template_id = e.j ->> 'template_id'
  CROSS JOIN LATERAL (
    SELECT
      round(LEAST(0.9999, GREATEST(0.0001, public._jnum(e.j, 'float', 0.22))), 5)::numeric(6, 5) AS fv,
      COALESCE(e.j -> 'stat_trak' = 'true'::jsonb, FALSE) AS st,
      LEAST(1000000, GREATEST(0, floor(public._jnum(e.j, 'kills', 0))))::int AS kills,
      COALESCE(e.j -> 'is_heirloom' = 'true'::jsonb, FALSE) AS heirloom
  ) AS f;

  -- Herança acima do limite do nível de Prestígio é descartada (ficam as mais valiosas)
  UPDATE public.inventory_items
  SET is_heirloom = FALSE
  WHERE user_id = v_uid AND is_heirloom
    AND uid NOT IN (
      SELECT uid FROM public.inventory_items
      WHERE user_id = v_uid AND is_heirloom
      ORDER BY price DESC, obtained_at, uid
      LIMIT LEAST(10, v_prestige + 1)
    );

  UPDATE public.profiles
  SET balance = LEAST(1000000000, GREATEST(0, round(public._jnum(p_save, 'balance', 500), 2))),
      last_claimed_at = now(),
      prestige_level = v_prestige,
      xp = LEAST(10000000, GREATEST(0, floor(public._jnum(p_save, 'xp', 0))))::bigint,
      cases_opened = LEAST(100000000, GREATEST(0, floor(public._jnum(p_save, 'cases_opened', 0))))::int,
      golds_unboxed = LEAST(100000000, GREATEST(0, floor(public._jnum(p_save, 'golds_unboxed', 0))))::int,
      tradeups_done = LEAST(100000000, GREATEST(0, floor(public._jnum(p_save, 'tradeups_done', 0))))::int,
      targets_hit = LEAST(1000000000, GREATEST(0, floor(public._jnum(p_save, 'targets_hit', 0))))::bigint,
      total_spent = LEAST(1000000000000, GREATEST(0, round(public._jnum(p_save, 'total_spent', 0), 2))),
      total_earned = LEAST(1000000000000, GREATEST(0, round(public._jnum(p_save, 'total_earned', 0), 2))),
      best_drop_value = COALESCE((SELECT max(price) FROM public.inventory_items WHERE user_id = v_uid), 0),
      legacy_imported = TRUE
  WHERE id = v_uid;

  PERFORM public._recompute_profile(v_uid);

  RETURN public._state_json(v_uid);
END;
$$;

-- M) Concessão de dias VIP (chamada apenas pelo webhook de pagamentos, com service_role)
CREATE OR REPLACE FUNCTION public.grant_vip_days_admin(p_user_id UUID, p_days INT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_until TIMESTAMPTZ;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 3650 THEN
    RAISE EXCEPTION 'Quantidade de dias VIP inválida.';
  END IF;

  -- Credita a renda acumulada com o teto antigo (12h) antes de o teto virar 24h
  PERFORM public.sync_lazy_idle_income(p_user_id);

  UPDATE public.profiles
  SET vip_until = GREATEST(COALESCE(vip_until, now()), now()) + make_interval(days => p_days),
      updated_at = now()
  WHERE id = p_user_id
  RETURNING vip_until INTO v_until;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil % não encontrado.', p_user_id;
  END IF;

  RETURN v_until;
END;
$$;

-- ============================================================================
-- PERMISSÕES DE EXECUÇÃO
-- Tudo começa bloqueado; só as RPCs do jogo são liberadas, e só para contas autenticadas.
-- (A lista é por nome para não tocar nas funções das extensões instaladas em `public`.)
-- ============================================================================
DO $$
DECLARE
  v_fn REGPROCEDURE;
  v_player_rpcs TEXT[] := ARRAY[
    'get_my_state_rpc', 'open_case_rpc', 'sell_items_rpc', 'sell_duplicates_rpc',
    'execute_tradeup_rpc', 'set_heirloom_rpc', 'prestige_up_rpc', 'register_unique_callsign_rpc',
    'start_gridshot_rpc', 'submit_gridshot_rpc', 'reset_progress_rpc', 'import_legacy_save_rpc'
  ];
  v_internal TEXT[] := ARRAY[
    '_rand', '_mil_level', '_wear_short', '_wear_mult', '_jnum', '_ensure_profile', '_item_json',
    '_inventory_json', '_profile_json', '_state_json', '_recompute_profile', '_grant_item',
    'sync_lazy_idle_income', 'grant_vip_days_admin'
  ];
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = ANY(v_player_rpcs || v_internal)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
  END LOOP;

  FOR v_fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = ANY(v_player_rpcs)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_vip_days_admin(UUID, INT) TO service_role;
