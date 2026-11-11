// ============================================================================
// NEON DROP // COMMERCIAL BACKEND ADAPTER (SUPABASE RPC + ANTI-CHEAT CLIENT)
// ============================================================================
// Para ativar o banco PostgreSQL do Supabase:
// 1. Crie um projeto gratuito em https://supabase.com
// 2. Ligue Authentication → Sign In / Providers → "Allow anonymous sign-ins"
// 3. Rode o arquivo `supabase/schema.sql` no SQL Editor do Supabase
// 4. Cole sua Project URL e Publishable/Anon Key abaixo:
//
// Com o schema novo aplicado, o servidor é a autoridade da economia inteira: o cliente só
// pede ações (abrir caixa, vender, forjar, prestigiar) e desenha o estado que o servidor devolve.

window.NEON_DROP_BACKEND_CONFIG = {
  SUPABASE_URL: 'https://mywlmdlrfewpmehqaghf.supabase.co', // região South America (São Paulo)
  SUPABASE_ANON_KEY: 'sb_publishable_VAXvcIXVxk96mXDBI1eEyg_3KoCbjC9',
};

const NEON_DROP_SESSION_KEY = 'neondrop_sb_session_v1';
const NEON_DROP_AUTH_LOCK = 'neondrop_sb_auth_lock';
// Respostas do Auth que dizem, sem ambiguidade, que a sessão guardada não existe mais
const NEON_DROP_SESSION_GONE_CODES = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
  'user_not_found',
  'invalid_grant',
]);

class NeonDropCommercialAdapter {
  constructor(config) {
    this.url = (config.SUPABASE_URL || '').replace(/\/+$/, '');
    this.anonKey = (config.SUPABASE_ANON_KEY || '').trim();
    this.isCommercialServerEnabled = Boolean(this.url && this.anonKey);
    this.session = this.loadSession();
    this.sessionPromise = null;
    this.signupBlockedUntil = 0;
    // 'network' (sem conexão / servidor fora) ou 'rejected' (login anônimo desligado, limite atingido)
    this.lastAuthFailure = null;
    this.activeGridshotSessionId = null;
    // Access token que o servidor recusou com 401 (vale só nesta aba, não vai para o storage)
    this.rejectedAccessToken = null;
    // Prazo base de uma requisição; chamadas com corpo grande usam um múltiplo dele
    this.requestTimeoutMs = 15000;
  }

  makeError(code, message, status = 0) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
  }

  // Requisição com prazo que cobre o envio, os cabeçalhos E a leitura do corpo: numa conexão
  // que trava sem falhar, nenhuma dessas etapas se resolveria sozinha.
  // Devolve { ok, status, data, parsed }; lança em falha de rede ou estouro do prazo.
  async request(url, options = {}, timeoutMs = this.requestTimeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      const text = await res.text();
      let data = null;
      let parsed = true;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          parsed = false;
        }
      }
      return { ok: res.ok, status: res.status, data, parsed };
    } finally {
      clearTimeout(timer);
    }
  }

  // --------------------------------------------------------------------------
  // SESSÃO ANÔNIMA (SUPABASE AUTH)
  // Cada navegador recebe uma conta anônima. O servidor amarra a linha do placar
  // a essa conta (profiles.id = auth.uid()), então ninguém escreve na linha alheia.
  // A sessão mora no localStorage, junto com o save do jogo.
  // --------------------------------------------------------------------------
  loadSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(NEON_DROP_SESSION_KEY) || 'null');
      if (parsed && parsed.access_token && parsed.refresh_token) return parsed;
    } catch (e) {
      // storage indisponível ou corrompido: segue sem sessão
    }
    return null;
  }

  storeSession(data) {
    const lifetimeMs = Math.max(10, Number(data.expires_in) || 3600) * 1000;
    this.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user?.id || this.session?.user_id || null,
      // Validade medida no relógio local, para não depender do relógio do jogador estar certo
      expires_at_ms: Date.now() + lifetimeMs,
      lifetime_ms: lifetimeMs,
    };
    try {
      localStorage.setItem(NEON_DROP_SESSION_KEY, JSON.stringify(this.session));
    } catch (e) {
      // sem storage a sessão vale só até recarregar a página
    }
    return this.session;
  }

  clearSession() {
    this.session = null;
    try {
      localStorage.removeItem(NEON_DROP_SESSION_KEY);
    } catch (e) {
      // ignore
    }
  }

  hasFreshSession() {
    const s = this.session;
    // Um token recusado pelo servidor não serve mais, diga o relógio local o que disser. Isso fica
    // só na memória: regravar o storage aqui apagaria a sessão que outra aba já tenha renovado.
    if (!s?.access_token || s.access_token === this.rejectedAccessToken) return false;
    // Renova um pouco antes de vencer: 60 s, ou 20% da validade em tokens de vida curta
    const margin = Math.min(60000, (s.lifetime_ms || 3600000) * 0.2);
    return s.expires_at_ms - margin > Date.now();
  }

  async authRequest(path, body) {
    try {
      const res = await this.request(`${this.url}/auth/v1/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.anonKey },
        body: JSON.stringify(body),
      });
      const data = res.data && typeof res.data === 'object' ? res.data : {};
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: {} };
    }
  }

  // A conta anônima só existe neste navegador: jogar fora o refresh token é perder o progresso.
  // Então só vale como "sessão extinta" a recusa explícita do Auth; chave trocada, proxy, WAF ou
  // resposta ilegível NÃO contam.
  isSessionGone(res) {
    if (res.status < 400 || res.status >= 500 || res.status === 429) return false;
    const d = res.data || {};
    const codes = [d.error_code, d.code, d.error].filter((c) => typeof c === 'string');
    if (codes.some((c) => NEON_DROP_SESSION_GONE_CODES.has(c))) return true;
    return /refresh token/i.test(String(d.msg || d.message || d.error_description || ''));
  }

  // Devolve a sessão válida (renovando ou criando a conta anônima) ou null se o Auth não estiver disponível.
  async ensureSession() {
    if (!this.isCommercialServerEnabled) return null;
    if (this.hasFreshSession()) return this.session;
    if (!this.sessionPromise) {
      // navigator.locks serializa a renovação entre abas: o refresh token é de uso único
      const run = () => this.acquireSession();
      const locked =
        typeof navigator !== 'undefined' && navigator.locks?.request
          ? navigator.locks.request(NEON_DROP_AUTH_LOCK, run)
          : run();
      this.sessionPromise = Promise.resolve(locked)
        .catch(() => null)
        .finally(() => {
          this.sessionPromise = null;
        });
    }
    return this.sessionPromise;
  }

  async acquireSession() {
    // Outra aba pode ter renovado a sessão enquanto esperávamos o lock
    const stored = this.loadSession();
    if (stored) this.session = stored;
    if (this.hasFreshSession()) return this.session;

    const isTransient = (status) => status === 0 || status === 429 || status >= 500;

    if (this.session?.refresh_token) {
      const res = await this.authRequest('token?grant_type=refresh_token', {
        refresh_token: this.session.refresh_token,
      });
      if (res.ok && res.data.access_token) {
        this.lastAuthFailure = null;
        return this.storeSession(res.data);
      }
      if (!this.isSessionGone(res)) {
        // Rede, limite, erro do servidor ou uma recusa que não fala do refresh token:
        // a conta fica guardada e a próxima ação tenta renovar de novo
        this.lastAuthFailure = isTransient(res.status) ? 'network' : 'rejected';
        return null;
      }
      // O Auth disse que esse refresh token / sessão não existe mais
      this.clearSession();
    }

    if (Date.now() < this.signupBlockedUntil) return null;
    const res = await this.authRequest('signup', { data: {}, gotrue_meta_security: {} });
    if (res.ok && res.data.access_token) {
      this.lastAuthFailure = null;
      return this.storeSession(res.data);
    }
    if (res.status === 0 || res.status >= 500) {
      // Sem conexão: a próxima tentativa pode ser imediata
      this.lastAuthFailure = 'network';
      return null;
    }
    // Login anônimo desligado no painel ou limite atingido: não insiste por 5 minutos
    this.lastAuthFailure = 'rejected';
    this.signupBlockedUntil = Date.now() + 5 * 60 * 1000;
    return null;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      apikey: this.anonKey,
    };
    if (this.hasFreshSession()) {
      headers.Authorization = `Bearer ${this.session.access_token}`;
    } else if (this.anonKey.startsWith('eyJ')) {
      // Chave anon legada (JWT). A chave nova `sb_publishable_` vai só no header apikey.
      headers.Authorization = `Bearer ${this.anonKey}`;
    }
    return headers;
  }

  // Erros saem com `code` (prefixo do RAISE do servidor, ex.: INSUFFICIENT_BALANCE, ou
  // NETWORK / RPC_MISSING / AUTH_REJECTED / SERVER_ERROR), `status` HTTP e `userMessage`.
  async rpc(fnName, params = {}, { timeoutMs = this.requestTimeoutMs } = {}) {
    if (!this.isCommercialServerEnabled) return null;
    await this.ensureSession();
    let sentToken = null;
    const call = () => {
      sentToken = this.hasFreshSession() ? this.session.access_token : null;
      return this.request(
        `${this.url}/rest/v1/rpc/${fnName}`,
        { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(params) },
        timeoutMs
      );
    };

    let res;
    try {
      res = await call();
      if (res.status === 401 && sentToken) {
        // Token recusado (expirou antes do previsto): renova e repete uma vez
        const userBefore = this.session?.user_id || null;
        this.rejectedAccessToken = sentToken;
        const renewed = await this.ensureSession();
        if (!renewed) {
          // Sem sessão nova não há o que repetir: sem token a chamada só voltaria outro 401
          throw this.makeError(
            this.lastAuthFailure === 'network' ? 'NETWORK' : 'AUTH_UNAVAILABLE',
            `Sessão não renovada (${fnName})`
          );
        }
        if (userBefore && renewed.user_id && renewed.user_id !== userBefore) {
          // A sessão antiga foi extinta e esta já é outra conta: a ação pedida era da conta anterior
          throw this.makeError('AUTH_REJECTED', `Conta de jogo substituída (${fnName})`, 401);
        }
        res = await call();
      }
    } catch (e) {
      // Erros nossos (makeError) têm code em texto; AbortError e afins têm code numérico ou nenhum
      if (typeof e?.code === 'string') throw e;
      throw this.makeError('NETWORK', `Sem conexão com o servidor (${fnName})`);
    }
    if (!res.ok) {
      const errData = res.data && typeof res.data === 'object' ? res.data : {};
      const message = String(errData.message || '');
      const tagged = /^([A-Z][A-Z0-9_]+):\s*([\s\S]*)$/.exec(message);
      const err = new Error(message || `Erro RPC (${fnName})`);
      err.status = res.status;
      err.pgCode = errData.code || null;
      if (tagged) {
        err.code = tagged[1];
        err.userMessage = tagged[2];
      } else if (res.status === 404 || errData.code === 'PGRST202') {
        err.code = 'RPC_MISSING';
      } else if (res.status === 401 || res.status === 403) {
        err.code = 'AUTH_REJECTED';
      } else if (res.status >= 500 || res.status === 429) {
        err.code = 'NETWORK';
      } else {
        err.code = 'SERVER_ERROR';
      }
      throw err;
    }
    // 200 com corpo cortado ou trocado no caminho: não dá para saber o que o servidor respondeu
    if (!res.parsed) throw this.makeError('NETWORK', `Resposta ilegível do servidor (${fnName})`);
    return res.data;
  }

  // RPC de jogo: só funciona com conta autenticada (auth.uid() é o dono do perfil)
  async gameRpc(fnName, params = {}, options = {}) {
    const session = await this.ensureSession();
    if (!session) {
      throw this.makeError(this.lastAuthFailure === 'network' ? 'NETWORK' : 'AUTH_UNAVAILABLE', 'Conta de jogo indisponível');
    }
    return await this.rpc(fnName, params, options);
  }

  // --------------------------------------------------------------------------
  // ECONOMIA AUTORITATIVA (supabase/schema.sql)
  // Toda resposta traz `profile` (saldo, $/s, XP, estatísticas) recalculado no servidor.
  // --------------------------------------------------------------------------
  getMyState() {
    // Resposta grande (inventário inteiro): prazo dobrado
    return this.gameRpc('get_my_state_rpc', {}, { timeoutMs: this.requestTimeoutMs * 2 });
  }

  openCase(caseId, count) {
    return this.gameRpc('open_case_rpc', { p_case_id: caseId, p_count: count });
  }

  sellItems(uids) {
    return this.gameRpc('sell_items_rpc', { p_uids: uids });
  }

  sellDuplicates() {
    return this.gameRpc('sell_duplicates_rpc');
  }

  executeTradeup(uids) {
    return this.gameRpc('execute_tradeup_rpc', { p_uids: uids });
  }

  setHeirloom(uid, locked) {
    return this.gameRpc('set_heirloom_rpc', { p_uid: uid, p_locked: locked });
  }

  prestigeUp() {
    return this.gameRpc('prestige_up_rpc');
  }

  registerCallsign(callsign) {
    return this.gameRpc('register_unique_callsign_rpc', { p_callsign: callsign });
  }

  resetProgress() {
    return this.gameRpc('reset_progress_rpc');
  }

  importLegacySave(save) {
    // Envio grande (até ~300 KB de save antigo): em conexão lenta o prazo base não basta
    return this.gameRpc('import_legacy_save_rpc', { p_save: save }, { timeoutMs: this.requestTimeoutMs * 4 });
  }

  startGridshot() {
    return this.gameRpc('start_gridshot_rpc');
  }

  // Resposta: { ok: true, reward, best_gridshot_score, updated, profile } ou { ok: false, error }
  submitGridshot({ sessionId, score, hits, shots, crits, equippedUid }) {
    return this.gameRpc('submit_gridshot_rpc', {
      p_session_id: sessionId,
      p_score: score,
      p_hits: hits,
      p_shots: shots,
      p_crits: crits,
      p_equipped_uid: equippedUid || null,
    });
  }

  async fetchLeaderboardProfiles() {
    if (!this.isCommercialServerEnabled) return null;
    const cols =
      'player_id,callsign,prestige_level,mil_level,xp,net_worth,passive_rate_per_sec,unique_skins_count,platinum_cases_count,best_gridshot_score,best_drop_value,golds_unboxed,cases_opened,updated_at';
    // Leitura pública: não cria conta anônima só para quem está olhando o placar
    const get = (path) =>
      this.request(`${this.url}/rest/v1/${path}`, { method: 'GET', headers: this.getHeaders(), cache: 'no-store' });

    let rows;
    try {
      // Schema novo: view pública, só com quem registrou Callsign ou já abriu alguma caixa
      let res = await get(
        `leaderboard_global_view?select=${cols},is_vip&or=(callsign.not.is.null,cases_opened.gt.0)&order=prestige_level.desc,net_worth.desc&limit=200`
      );
      // Só quando a view NÃO EXISTE (schema antigo) lê a tabela, que lá tinha leitura pública.
      // No schema atual a tabela devolve apenas a linha do próprio jogador: usá-la num erro
      // passageiro da view trocaria o placar global por um placar de uma pessoa só.
      const viewMissing = res.status === 404 || ['PGRST205', '42P01'].includes(res.data?.code);
      if (!res.ok && viewMissing) res = await get(`profiles?select=${cols}&limit=100`);
      if (!res.ok || !Array.isArray(res.data)) return null;
      rows = res.data;
    } catch (e) {
      return null;
    }
    return rows.map((r) => ({
      playerId: r.player_id,
      callsign: r.callsign || ('Operador-' + String(r.player_id || '0000').slice(-4).toUpperCase()),
      prestigeLevel: r.prestige_level,
      milLevel: r.mil_level,
      xp: r.xp,
      netWorth: Number(r.net_worth),
      passiveRate: Number(r.passive_rate_per_sec),
      uniqueSkins: r.unique_skins_count,
      platinumCases: r.platinum_cases_count,
      bestGridshotScore: r.best_gridshot_score,
      bestDropValue: Number(r.best_drop_value),
      goldsUnboxed: r.golds_unboxed,
      casesOpened: r.cases_opened,
      isVip: Boolean(r.is_vip),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    }));
  }

  // --------------------------------------------------------------------------
  // MODO LEGADO (banco ainda no schema anterior, economia no navegador)
  // --------------------------------------------------------------------------
  // Resposta do servidor: { ok, player_id, callsign, best_gridshot_score }.
  // `player_id` é o ID oficial do operador (o da conta autenticada), não o enviado aqui.
  async syncOperatorLeaderboard(entry) {
    if (!this.isCommercialServerEnabled) return null;
    return await this.rpc('sync_operator_leaderboard_rpc', {
      p_player_id: entry.playerId,
      p_callsign: entry.callsign,
      p_prestige_level: entry.prestigeLevel,
      p_mil_level: entry.milLevel,
      p_xp: Math.floor(entry.xp || 0),
      p_net_worth: entry.netWorth,
      p_passive_rate: entry.passiveRate,
      p_unique_skins: entry.uniqueSkins,
      p_platinum_cases: entry.platinumCases,
      p_best_gridshot_score: entry.bestGridshotScore || 0,
      p_best_drop_value: entry.bestDropValue || 0,
      p_golds_unboxed: entry.goldsUnboxed || 0,
      p_cases_opened: entry.casesOpened || 0,
    });
  }

  async startGridshotSession() {
    // Zera na hora: uma rodada nunca reaproveita o ID de sessão da rodada anterior
    this.activeGridshotSessionId = null;
    const localId = 'local_' + Date.now();
    // start_gridshot_rpc exige auth.uid(); sem sessão a rodada vale só localmente
    const session = await this.ensureSession();
    if (!session) {
      this.activeGridshotSessionId = localId;
      return localId;
    }
    this.activeGridshotSessionId = await this.rpc('start_gridshot_rpc').catch(() => localId);
    return this.activeGridshotSessionId;
  }

  // Resposta do servidor: { ok: true, reward, best_gridshot_score } ou { ok: false, error }.
  async submitGridshotSession({ score, hits, shots }) {
    if (!this.isCommercialServerEnabled || !this.activeGridshotSessionId || String(this.activeGridshotSessionId).startsWith('local_')) {
      return null;
    }
    const sessionId = this.activeGridshotSessionId;
    this.activeGridshotSessionId = null;
    return await this.rpc('submit_gridshot_rpc', {
      p_session_id: sessionId,
      p_score: score,
      p_hits: hits,
      p_shots: shots,
      // O inventário ainda vive no navegador (IDs `itm_...`, não UUIDs do servidor),
      // então a arma equipada não é enviada para validação.
      p_equipped_uid: null,
    });
  }
}

window.neonBackend = new NeonDropCommercialAdapter(window.NEON_DROP_BACKEND_CONFIG);
