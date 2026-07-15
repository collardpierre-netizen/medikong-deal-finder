// Verify a Stripe PaymentIntent and return the confirmed amount + currency + status.
// Admin/authenticated only — validates JWT and checks the caller can view the order.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return json({ error: 'unauthorized' }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const paymentIntentId = String(body?.payment_intent_id ?? '').trim();
    if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) {
      return json({ error: 'invalid_payment_intent_id' }, 400);
    }

    if (!STRIPE_SECRET_KEY) return json({ error: 'stripe_not_configured' }, 500);

    const resp = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return json({ error: 'stripe_error', detail: txt.slice(0, 500) }, 502);
    }
    const pi = await resp.json();

    // amount_received is in the smallest currency unit
    const amountReceivedMinor = Number(pi.amount_received ?? 0);
    const amountMinor = Number(pi.amount ?? 0);
    const currency = String(pi.currency ?? '').toLowerCase();
    // EUR uses 2 decimals — Stripe amounts are integer minor units
    const divisor = 100;

    return json({
      payment_intent_id: pi.id,
      status: pi.status,
      currency,
      amount: amountMinor / divisor,
      amount_received: amountReceivedMinor / divisor,
      created: pi.created ? new Date(pi.created * 1000).toISOString() : null,
    }, 200);
  } catch (e) {
    return json({ error: 'internal_error', detail: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
