-- ============================================================================
-- NEON DROP // SUPABASE SERVER-AUTHORITATIVE SCHEMA & ANTI-CHEAT RPCs
-- Execute este script no SQL Editor do seu projeto Supabase (https://supabase.com)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- 1. TABELA DE PERFIS DE OPERADORES (ESTADO OFICIAL NO SERVIDOR)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  callsign CITEXT UNIQUE, -- CITEXT garante unicidade case-insensitive no motor do Postgres!
  callsign_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  balance NUMERIC(16, 2) NOT NULL DEFAULT 500.00 CHECK (balance >= 0),
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

-- 2. TABELA DE INVENTÁRIO DE SKINS & LÂMINAS
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

-- 3. TABELA DE SESSÕES DO AIM LAB (GRIDSHOT 30s ANTI-MACRO)
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

-- 4. TABELA DE AUDITORIA DE PAGAMENTOS (PIX / STRIPE WEBHOOK IDEMPOTENCY)
CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_tx_id TEXT NOT NULL UNIQUE, -- Impede crédito duplicado do mesmo Pix/Stripe
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  amount_brl NUMERIC(10, 2) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) — ZERO CONFIANÇA NO CLIENTE
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gridshot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;

-- Jogadores podem ler todos os perfis públicos para o Ranking Global, mas NUNCA editar via cliente
CREATE POLICY "Leitura publica de perfis para Ranking"
  ON public.profiles FOR SELECT
  USING (true);

-- Jogadores podem ler apenas seus próprios itens do inventário
CREATE POLICY "Leitura do proprio inventario"
  ON public.inventory_items FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- STORED PROCEDURES (SECURITY DEFINER) — LÓGICA EXECUTADA 100% NO SERVIDOR
-- ============================================================================

-- A) Sincronização Lazy de Renda Passiva (usa o relógio oficial do servidor PostgreSQL)
CREATE OR REPLACE FUNCTION public.sync_lazy_idle_income(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_elapsed_sec < 1 THEN
    RETURN v_profile.balance;
  END IF;

  v_earned := ROUND((v_elapsed_sec * v_profile.passive_rate_per_sec)::numeric, 2);

  UPDATE public.profiles
  SET balance = balance + v_earned,
      last_claimed_at = now(),
      updated_at = now()
  WHERE id = p_user_id
  RETURNING balance INTO v_profile.balance;

  RETURN v_profile.balance;
END;
$$;

-- B) Registro Único e Permanente de Callsign
CREATE OR REPLACE FUNCTION public.register_unique_callsign_rpc(p_callsign TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean TEXT := btrim(p_callsign);
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Operador não autenticado.';
  END IF;

  IF char_length(v_clean) < 3 OR char_length(v_clean) > 18 THEN
    RAISE EXCEPTION 'O Callsign deve ter entre 3 e 18 caracteres.';
  END IF;

  IF lower(v_clean) LIKE 'operador-%' THEN
    RAISE EXCEPTION 'Escolha um Callsign personalizado.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;

  IF v_profile.callsign_locked THEN
    RAISE EXCEPTION 'Seu Callsign já está travado permanentemente como "%".', v_profile.callsign;
  END IF;

  -- Verifica se outro operador já registrou este Callsign (CITEXT é case-insensitive)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE callsign = v_clean AND id <> v_uid) THEN
    RAISE EXCEPTION 'O Callsign "%" já pertence a outro operador!', v_clean;
  END IF;

  UPDATE public.profiles
  SET callsign = v_clean,
      callsign_locked = TRUE,
      updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'callsign', v_clean);
END;
$$;

-- C) Iniciar Sessão Assinada do Gridshot 30s
CREATE OR REPLACE FUNCTION public.start_gridshot_rpc()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_next_allowed TIMESTAMPTZ;
  v_session_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Operador não autenticado.';
  END IF;

  SELECT next_gridshot_allowed_at INTO v_next_allowed
  FROM public.profiles
  WHERE id = v_uid;

  IF v_next_allowed IS NOT NULL AND now() < v_next_allowed THEN
    RAISE EXCEPTION 'Estande em recarga. Aguarde alguns segundos.';
  END IF;

  INSERT INTO public.gridshot_sessions (user_id, started_at)
  VALUES (v_uid, now())
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

-- D) Validar e Finalizar Rodada do Gridshot 30s (Anti-Macro & Anti-Speedhack)
CREATE OR REPLACE FUNCTION public.submit_gridshot_rpc(
  p_session_id UUID,
  p_score INT,
  p_hits INT,
  p_shots INT,
  p_equipped_uid UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sess public.gridshot_sessions%ROWTYPE;
  v_prof public.profiles%ROWTYPE;
  v_elapsed NUMERIC;
  v_weapon_mult NUMERIC := 1.00;
  v_item public.inventory_items%ROWTYPE;
  v_seconds_equiv NUMERIC := 0;
  v_min_floor NUMERIC := 0;
  v_reward NUMERIC := 0;
BEGIN
  SELECT * INTO v_sess
  FROM public.gridshot_sessions
  WHERE id = p_session_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND OR v_sess.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sessão de treino inválida ou já finalizada.';
  END IF;

  -- 1. Valida tempo real decorrido no relógio do servidor (28s a 45s)
  v_elapsed := EXTRACT(EPOCH FROM (now() - v_sess.started_at));
  IF v_elapsed < 28 OR v_elapsed > 45 THEN
    UPDATE public.gridshot_sessions SET flagged_cheat = TRUE, completed_at = now() WHERE id = p_session_id;
    RAISE EXCEPTION 'Tempo de sessão inválido (% segundos).', round(v_elapsed, 1);
  END IF;

  -- 2. Valida teto físico humano (máximo 135 acertos em 30s = 4.5 alvos/s ininterruptos)
  IF p_hits < 0 OR p_hits > 135 OR p_score < 0 OR p_score > (p_hits * 300) THEN
    UPDATE public.gridshot_sessions SET flagged_cheat = TRUE, completed_at = now() WHERE id = p_session_id;
    RAISE EXCEPTION 'Anomalia de telemetria detectada (Anti-Macro).';
  END IF;

  PERFORM public.sync_lazy_idle_income(v_uid);
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;

  -- 3. Verifica arma equipada no inventário oficial do servidor e atualiza SyncTrack™
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
        UPDATE public.inventory_items SET kills = kills + p_hits WHERE uid = v_item.uid;
      END IF;
    END IF;
  END IF;

  -- 4. Calcula recompensa por Rank (S, A, B, C)
  IF p_score >= 6000 THEN
    v_seconds_equiv := 22; v_min_floor := 35;
  ELSIF p_score >= 4000 THEN
    v_seconds_equiv := 15; v_min_floor := 25;
  ELSIF p_score >= 2000 THEN
    v_seconds_equiv := 9;  v_min_floor := 15;
  ELSIF p_score > 0 THEN
    v_seconds_equiv := 4 * (p_score::numeric / 2000.0);
    v_min_floor := 5 * (p_score::numeric / 2000.0);
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
  SET balance = balance + v_reward,
      xp = xp + (p_hits * 3),
      best_gridshot_score = GREATEST(best_gridshot_score, p_score),
      next_gridshot_allowed_at = now() + interval '15 seconds',
      updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'reward', v_reward,
    'best_gridshot_score', GREATEST(v_prof.best_gridshot_score, p_score)
  );
END;
$$;
