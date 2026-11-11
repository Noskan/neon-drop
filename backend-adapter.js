// ============================================================================
// NEON DROP // COMMERCIAL BACKEND ADAPTER (SUPABASE RPC + ANTI-CHEAT CLIENT)
// ============================================================================
// Para ativar o banco PostgreSQL do Supabase:
// 1. Crie um projeto gratuito em https://supabase.com
// 2. Rode o arquivo `supabase/schema.sql` no SQL Editor do Supabase
// 3. Cole sua Project URL e Publishable/Anon Key abaixo:

window.NEON_DROP_BACKEND_CONFIG = {
  SUPABASE_URL: 'https://tyovbizpnmhntrlsuduo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_vx52595_GT8VP7dq02KZxA_X2udDG9k',
};

class NeonDropCommercialAdapter {
  constructor(config) {
    this.url = (config.SUPABASE_URL || '').replace(/\/+$/, '');
    this.anonKey = (config.SUPABASE_ANON_KEY || '').trim();
    this.isCommercialServerEnabled = Boolean(this.url && this.anonKey);
    this.accessToken = null;
    this.activeGridshotSessionId = null;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      apikey: this.anonKey,
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    } else if (this.anonKey.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${this.anonKey}`;
    }
    return headers;
  }

  async rpc(fnName, params = {}) {
    if (!this.isCommercialServerEnabled) return null;
    const res = await fetch(`${this.url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Erro RPC (${fnName})`);
    }
    return await res.json();
  }

  async fetchLeaderboardProfiles() {
    if (!this.isCommercialServerEnabled) return null;
    const res = await fetch(
      `${this.url}/rest/v1/profiles?select=player_id,callsign,prestige_level,mil_level,xp,net_worth,passive_rate_per_sec,unique_skins_count,platinum_cases_count,best_gridshot_score,best_drop_value,golds_unboxed,cases_opened,updated_at&limit=100`,
      {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
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
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    }));
  }

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
    if (!this.isCommercialServerEnabled) {
      this.activeGridshotSessionId = 'local_' + Date.now();
      return this.activeGridshotSessionId;
    }
    this.activeGridshotSessionId = await this.rpc('start_gridshot_rpc').catch(() => 'local_' + Date.now());
    return this.activeGridshotSessionId;
  }

  async submitGridshotSession({ score, hits, shots, equippedUid }) {
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
      p_equipped_uid: equippedUid || null,
    });
  }
}

window.neonBackend = new NeonDropCommercialAdapter(window.NEON_DROP_BACKEND_CONFIG);
