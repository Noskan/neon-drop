// ============================================================================
// NEON DROP // SUPABASE EDGE FUNCTION: PIX & STRIPE PAYMENT WEBHOOK
// Deploy via: supabase functions deploy payment-webhook --no-verify-jwt
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? '';

async function verifyHmacSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET || !signatureHeader) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = new Uint8Array(
    (signatureHeader.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
  );
  return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(rawBody));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('x-webhook-signature');

  const isValid = await verifyHmacSignature(rawBody, sig);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid HMAC signature' }), { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  const { external_tx_id, user_id, product_code, amount_brl } = payload;
  if (!external_tx_id || !user_id || !product_code) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Idempotency Guard: insert into payment_ledger (UNIQUE external_tx_id)
  const { error: ledgerErr } = await supabaseAdmin.from('payment_ledger').insert({
    external_tx_id,
    user_id,
    product_code,
    amount_brl,
  });

  if (ledgerErr) {
    // 23505 = unique_violation: this transaction was already credited
    if (ledgerErr.code === '23505') {
      return new Response(JSON.stringify({ status: 'already_processed' }), { status: 200 });
    }
    // Anything else (unknown user, DB outage...) must NOT be acknowledged, so the provider retries
    return new Response(JSON.stringify({ error: 'Ledger insert failed', code: ledgerErr.code }), { status: 500 });
  }

  // 2. Grant VIP / Battle Pass entitlement on the authoritative profile
  if (product_code === 'vip_30d') {
    const { error: grantErr } = await supabaseAdmin.rpc('grant_vip_days_admin', {
      p_user_id: user_id,
      p_days: 30,
    });
    if (grantErr) {
      // Undo the ledger row so the provider's retry can credit the purchase
      await supabaseAdmin.from('payment_ledger').delete().eq('external_tx_id', external_tx_id);
      return new Response(JSON.stringify({ error: 'Entitlement grant failed' }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
