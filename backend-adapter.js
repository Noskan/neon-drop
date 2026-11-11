// ============================================================================
// NEON DROP // COMMERCIAL BACKEND ADAPTER (SUPABASE RPC + ANTI-CHEAT CLIENT)
// ============================================================================
// Para ativar o modo Server-Authoritative em produção:
// 1. Crie um projeto gratuito em https://supabase.com
// 2. Rode o arquivo `supabase/schema.sql` no SQL Editor do Supabase
// 3. Preencha SUPABASE_URL e SUPABASE_ANON_KEY abaixo.
// Enquanto estiverem vazios, o jogo opera automaticamente no modo Híbrido/Protótipo.

window.NEON_DROP_BACKEND_CONFIG = {
  SUPABASE_URL: '', // Ex: 'https://xyzcompany.supabase.co'
  SUPABASE_ANON_KEY: '', // Ex: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};

class NeonDropCommercialAdapter {
  constructor(config) {
    this.url = config.SUPABASE_URL;
    this.anonKey = config.SUPABASE_ANON_KEY;
    this.isCommercialServerEnabled = Boolean(this.url && this.anonKey);
    this.accessToken = null;
    this.activeGridshotSessionId = null;
  }

  async rpc(fnName, params = {}) {
    if (!this.isCommercialServerEnabled) return null;
    const res = await fetch(`${this.url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.anonKey,
        Authorization: `Bearer ${this.accessToken || this.anonKey}`,
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Erro RPC (${fnName})`);
    }
    return await res.json();
  }

  async startGridshotSession() {
    if (!this.isCommercialServerEnabled) {
      this.activeGridshotSessionId = 'local_' + Date.now();
      return this.activeGridshotSessionId;
    }
    this.activeGridshotSessionId = await this.rpc('start_gridshot_rpc');
    return this.activeGridshotSessionId;
  }

  async submitGridshotSession({ score, hits, shots, equippedUid }) {
    if (!this.isCommercialServerEnabled || !this.activeGridshotSessionId) {
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

  async registerUniqueCallsign(callsign) {
    if (!this.isCommercialServerEnabled) return null;
    return await this.rpc('register_unique_callsign_rpc', {
      p_callsign: callsign,
    });
  }
}

window.neonBackend = new NeonDropCommercialAdapter(window.NEON_DROP_BACKEND_CONFIG);
