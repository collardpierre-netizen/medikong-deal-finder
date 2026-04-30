// RFQ Dispatcher (Lot 2 — routing engine)
// - Appelée par le client APRES l'INSERT d'une rfq par l'acheteur
// - Délègue à la RPC SQL `rfq_dispatch` qui résout les vendeurs (offres
//   produit + intérêts marque/fabricant/produit), insère idempotemment dans
//   rfq_dispatch_log et crée les vendor_notifications.
// - Renvoie un récap (vendors_targeted, new, duplicates).
//
// Auth : token utilisateur acheteur OU service_role (admin/cron).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BodySchema = z.object({
  rfq_id: z.string().uuid(),
});

interface DispatchResult {
  rfq_id: string;
  vendors_targeted: number;
  new_dispatches: number;
  duplicates_skipped: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY);

  // For RPC we want to call as the buyer (so the SECURITY DEFINER auth.uid()
  // check inside rfq_dispatch validates ownership). Use the user JWT.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: unknown;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { rfq_id } = parsed.data;

  // Pre-check (and load some metadata for the response email)
  const { data: rfq, error: rfqErr } = await adminClient
    .from("rfqs")
    .select("id, buyer_user_id, product_id, brand_id, quantity, destination_country_code, responses_deadline, status")
    .eq("id", rfq_id)
    .maybeSingle();

  if (rfqErr || !rfq) {
    return new Response(JSON.stringify({ error: "RFQ not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Call the dispatch RPC (uses auth.uid() for ownership check; service_role bypasses).
  const dispatchClient = isServiceRole ? adminClient : userClient;
  const { data: dispatchRows, error: dispErr } = await dispatchClient
    .rpc("rfq_dispatch", { _rfq_id: rfq_id });

  if (dispErr) {
    return new Response(JSON.stringify({ error: dispErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (dispatchRows as Array<{ vendor_id: string; reason: string; was_new: boolean }>) || [];
  const result: DispatchResult = {
    rfq_id,
    vendors_targeted: rows.length,
    new_dispatches: rows.filter(r => r.was_new).length,
    duplicates_skipped: rows.filter(r => !r.was_new).length,
  };

  // --- Send recap email to each newly-dispatched vendor (best-effort) ---
  if (result.new_dispatches > 0) {
    // Load product/brand names + vendor emails + tracking tokens
    const newVendorIds = rows.filter(r => r.was_new).map(r => r.vendor_id);

    const [{ data: vendors }, { data: dispatchLog }, { data: product }, { data: brand }] = await Promise.all([
      adminClient.from("vendors").select("id, name, contact_email, auth_user_id").in("id", newVendorIds),
      adminClient.from("rfq_dispatch_log").select("vendor_id, tracking_token").eq("rfq_id", rfq_id).in("vendor_id", newVendorIds),
      rfq.product_id
        ? adminClient.from("products").select("name").eq("id", rfq.product_id).maybeSingle()
        : Promise.resolve({ data: null }),
      rfq.brand_id
        ? adminClient.from("brands").select("name").eq("id", rfq.brand_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const productName = (product as any)?.name ?? null;
    const brandName = (brand as any)?.name ?? null;
    const tokenByVendor = new Map((dispatchLog ?? []).map((d: any) => [d.vendor_id, d.tracking_token]));

    // Fire-and-forget email sends
    await Promise.all((vendors ?? []).map(async (v: any) => {
      const email = v.contact_email;
      if (!email) return;
      const token = tokenByVendor.get(v.id);
      try {
        await adminClient.functions.invoke("send-transactional-email", {
          body: {
            templateName: "rfq-vendor-invitation",
            recipientEmail: email,
            idempotencyKey: `rfq-invite-${rfq_id}-${v.id}`,
            templateData: {
              vendorName: v.name ?? "",
              productName,
              brandName,
              quantity: rfq.quantity,
              countryCode: rfq.destination_country_code,
              deadline: rfq.responses_deadline,
              rfqUrl: `https://medikong-deal-finder.lovable.app/vendor/rfq/${rfq_id}?t=${token}`,
              trackingPixelUrl: `${SUPABASE_URL}/functions/v1/rfq-track?t=${token}&e=email_opened`,
            },
          },
        });
      } catch (e) {
        // best-effort, do not fail the dispatch
        console.error(`email failed for vendor ${v.id}`, e);
      }
    }));
  }

  return new Response(JSON.stringify(result), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
