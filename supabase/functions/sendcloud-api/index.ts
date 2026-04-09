import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENDCLOUD_BASE = Deno.env.get("SENDCLOUD_API_BASE_URL") || "https://panel.sendcloud.sc/api/v2";
const SENDCLOUD_PUBLIC = Deno.env.get("SENDCLOUD_PUBLIC_KEY") || "";
const SENDCLOUD_SECRET = Deno.env.get("SENDCLOUD_SECRET_KEY") || "";

const AUTH_HEADER = "Basic " + btoa(`${SENDCLOUD_PUBLIC}:${SENDCLOUD_SECRET}`);

interface ApiRequest {
  operation: string;
  payload?: Record<string, unknown>;
}

// Retry with exponential backoff
async function fetchWithRetry(url: string, opts: RequestInit, retries = 3): Promise<Response> {
  const delays = [500, 1000, 2000];
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, opts);
    if (res.status < 500) return res;
    if (i < retries - 1) await new Promise(r => setTimeout(r, delays[i]));
  }
  return fetch(url, opts);
}

function sendcloudHeaders(): Record<string, string> {
  return {
    Authorization: AUTH_HEADER,
    "Content-Type": "application/json",
  };
}

async function logApiCall(supabase: ReturnType<typeof createClient>, userId: string | null, operation: string, statusCode: number, durationMs: number, errorMessage?: string) {
  await supabase.from("restock_sendcloud_api_logs").insert({
    user_id: userId,
    operation,
    status_code: statusCode,
    duration_ms: durationMs,
    error_message: errorMessage || null,
  });
}

// Operations
async function createSenderAddress(payload: Record<string, unknown>) {
  const body = {
    company_name: payload.company_name,
    contact_name: payload.contact_name,
    email: payload.email,
    telephone: payload.telephone,
    street: payload.street,
    house_number: payload.house_number || "",
    postal_code: payload.postal_code,
    city: payload.city,
    country: payload.country || "BE",
  };
  return fetchWithRetry(`${SENDCLOUD_BASE}/user/addresses/sender`, {
    method: "POST",
    headers: sendcloudHeaders(),
    body: JSON.stringify(body),
  });
}

async function updateSenderAddress(payload: Record<string, unknown>) {
  const id = payload.sender_address_id;
  const body = { ...payload };
  delete body.sender_address_id;
  return fetchWithRetry(`${SENDCLOUD_BASE}/user/addresses/sender/${id}`, {
    method: "PUT",
    headers: sendcloudHeaders(),
    body: JSON.stringify(body),
  });
}

async function createBrand(payload: Record<string, unknown>) {
  return fetchWithRetry(`${SENDCLOUD_BASE}/brands`, {
    method: "POST",
    headers: sendcloudHeaders(),
    body: JSON.stringify({
      name: payload.name || "Pharmacie anonyme",
      logo_url: payload.logo_url || null,
      color: payload.color || "#1C58D9",
      tracking_page_message: payload.message || "",
    }),
  });
}

async function createParcel(payload: Record<string, unknown>) {
  const parcelData = {
    parcel: {
      name: payload.to_name,
      company_name: payload.to_company || "",
      address: payload.to_address,
      city: payload.to_city,
      postal_code: payload.to_postal_code,
      country: payload.to_country || "BE",
      telephone: payload.to_phone || "",
      email: payload.to_email || "",
      weight: payload.weight_kg || 1,
      order_number: payload.order_reference || "",
      sender_address: payload.sender_address_id ? Number(payload.sender_address_id) : undefined,
      request_label: true,
      apply_shipping_rules: true,
      shipment: payload.shipping_method_id ? { id: Number(payload.shipping_method_id) } : undefined,
    },
  };
  return fetchWithRetry(`${SENDCLOUD_BASE}/parcels`, {
    method: "POST",
    headers: sendcloudHeaders(),
    body: JSON.stringify(parcelData),
  });
}

async function getShippingMethods(payload: Record<string, unknown>) {
  const from = payload.from_country || "BE";
  const to = payload.to_country || "BE";
  const weight = payload.weight_kg || 1;
  return fetchWithRetry(
    `${SENDCLOUD_BASE}/shipping_methods?from_country=${from}&to_country=${to}&weight=${weight}`,
    { method: "GET", headers: sendcloudHeaders() }
  );
}

async function getLabel(payload: Record<string, unknown>) {
  return fetchWithRetry(
    `${SENDCLOUD_BASE}/labels/${payload.parcel_id}`,
    { method: "GET", headers: sendcloudHeaders() }
  );
}

async function cancelParcel(payload: Record<string, unknown>) {
  return fetchWithRetry(
    `${SENDCLOUD_BASE}/parcels/${payload.parcel_id}/cancel`,
    { method: "POST", headers: sendcloudHeaders() }
  );
}

async function getTracking(payload: Record<string, unknown>) {
  return fetchWithRetry(
    `${SENDCLOUD_BASE}/parcels/${payload.parcel_id}`,
    { method: "GET", headers: sendcloudHeaders() }
  );
}

const OPERATIONS: Record<string, (p: Record<string, unknown>) => Promise<Response>> = {
  createSenderAddress,
  updateSenderAddress,
  createBrand,
  createParcel,
  getShippingMethods,
  getLabel,
  cancelParcel,
  getTracking,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = user.id;

  // Check Sendcloud credentials
  if (!SENDCLOUD_PUBLIC || !SENDCLOUD_SECRET) {
    return new Response(JSON.stringify({ success: false, error: "Sendcloud credentials not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: ApiRequest = await req.json();
    const { operation, payload = {} } = body;

    const handler = OPERATIONS[operation];
    if (!handler) {
      return new Response(JSON.stringify({ success: false, error: `Unknown operation: ${operation}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const start = Date.now();
    const res = await handler(payload);
    const duration = Date.now() - start;
    const data = await res.json();

    await logApiCall(supabase, userId, operation, res.status, duration, res.ok ? undefined : JSON.stringify(data));

    return new Response(JSON.stringify({ success: res.ok, data, status: res.status }), {
      status: res.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
