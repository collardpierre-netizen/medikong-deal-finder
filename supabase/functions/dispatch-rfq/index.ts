// Dispatcher de RFQ (demandes de prix)
// - Appelée par le client APRES l'INSERT d'une rfq par l'acheteur
// - Identifie les vendeurs cibles via la fonction SQL get_rfq_target_vendor_ids
// - Crée vendor_notifications (type='rfq_received') idempotentes
// - Renvoie le nombre de vendeurs notifiés (sans exposer leurs identités)
//
// Auth : token utilisateur acheteur OU service_role (admin/cron).
// Validation Zod stricte sur le body.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  rfq_id: z.string().uuid(),
});

interface DispatchResult {
  rfq_id: string;
  vendors_targeted: number;
  notifications_created: number;
  duplicates_skipped: number;
  errors: string[];
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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // --- AUTH ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY);
  let callerUserId: string | null = null;

  if (!isServiceRole) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userResp, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userResp.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    callerUserId = userResp.user.id;
  }

  // --- VALIDATION ---
  let body: unknown;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({
      error: parsed.error.flatten().fieldErrors,
    }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { rfq_id } = parsed.data;

  // --- LOAD RFQ ---
  const { data: rfq, error: rfqErr } = await supabase
    .from("rfqs")
    .select("id, buyer_user_id, product_id, brand_id, target_scope, quantity, destination_country_code, responses_deadline, status")
    .eq("id", rfq_id)
    .maybeSingle();

  if (rfqErr || !rfq) {
    return new Response(JSON.stringify({ error: "RFQ not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Caller doit être le buyer ou admin (service_role)
  if (!isServiceRole && callerUserId !== rfq.buyer_user_id) {
    return new Response(JSON.stringify({ error: "Forbidden — only the RFQ buyer can dispatch" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (rfq.status !== "open") {
    return new Response(JSON.stringify({ error: `RFQ status is '${rfq.status}', cannot dispatch` }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- TARGET VENDORS ---
  const { data: targets, error: targetsErr } = await supabase
    .rpc("get_rfq_target_vendor_ids", { _rfq_id: rfq_id });

  if (targetsErr) {
    return new Response(JSON.stringify({ error: targetsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const vendorIds: string[] = (targets || []).map((t: any) => t.vendor_id);

  const result: DispatchResult = {
    rfq_id,
    vendors_targeted: vendorIds.length,
    notifications_created: 0,
    duplicates_skipped: 0,
    errors: [],
  };

  if (vendorIds.length === 0) {
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- LOAD PRODUCT/BRAND METADATA pour le titre & corps ---
  let productName: string | null = null;
  let brandName: string | null = null;
  if (rfq.product_id) {
    const { data: p } = await supabase.from("products").select("name").eq("id", rfq.product_id).maybeSingle();
    productName = p?.name ?? null;
  }
  if (rfq.brand_id) {
    const { data: b } = await supabase.from("brands").select("name").eq("id", rfq.brand_id).maybeSingle();
    brandName = b?.name ?? null;
  }

  const subject = productName
    ? `Demande de prix : ${productName} (×${rfq.quantity})`
    : `Demande de prix marque ${brandName ?? "—"} (×${rfq.quantity})`;
  const bodyText = `Un acheteur vérifié a publié une demande de prix ciblant votre catalogue.
Quantité : ${rfq.quantity}
Pays livraison : ${rfq.destination_country_code}
Réponse attendue avant : ${new Date(rfq.responses_deadline).toLocaleDateString("fr-FR")}
Connectez-vous à votre portail vendeur pour répondre.`;
  const ctaUrl = `/vendor/rfq/${rfq_id}`;

  // --- INSERT NOTIFICATIONS (idempotent : skip si déjà notifié) ---
  // On vérifie d'abord les vendor_id déjà notifiés pour cette RFQ
  const { data: existing } = await supabase
    .from("vendor_notifications")
    .select("vendor_id")
    .eq("type", "rfq_received")
    .contains("payload", { rfq_id });

  const alreadyNotified = new Set((existing ?? []).map((r: any) => r.vendor_id));
  const newRows = vendorIds
    .filter(vid => !alreadyNotified.has(vid))
    .map(vid => ({
      vendor_id: vid,
      type: "rfq_received",
      title: subject,
      body: bodyText,
      payload: {
        rfq_id,
        product_id: rfq.product_id,
        brand_id: rfq.brand_id,
        quantity: rfq.quantity,
        country: rfq.destination_country_code,
        deadline: rfq.responses_deadline,
      },
      cta_url: ctaUrl,
    }));

  result.duplicates_skipped = vendorIds.length - newRows.length;

  if (newRows.length > 0) {
    const { error: insErr, count } = await supabase
      .from("vendor_notifications")
      .insert(newRows, { count: "exact" });
    if (insErr) {
      result.errors.push(`insert vendor_notifications: ${insErr.message}`);
    } else {
      result.notifications_created = count ?? newRows.length;
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
