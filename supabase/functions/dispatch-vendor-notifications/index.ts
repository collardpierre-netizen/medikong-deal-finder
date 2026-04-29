// Dispatcher de notifications vendeur
// - Parcourt les nouvelles entrées catalogue (products / brands / manufacturers) approuvées récemment
// - Match avec les vendor_catalog_interests
// - Insère les vendor_notifications + log de dispatch (idempotent)
//
// À appeler manuellement par un admin ou via cron pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DispatchResult {
  scanned_products: number;
  scanned_brands: number;
  scanned_manufacturers: number;
  notifications_created: number;
  duplicates_skipped: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Auth: only admin OR service-role caller (cron)
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY);

  if (!isServiceRole) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userResp, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userResp.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", userResp.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 2. Body: dryRun + lookbackDays
  let body: any = {};
  try { body = await req.json(); } catch { /* no body */ }
  const dryRun: boolean = !!body?.dryRun;
  const lookbackDays: number = Math.max(1, Math.min(30, Number(body?.lookbackDays ?? 7)));
  const since = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  const result: DispatchResult = {
    scanned_products: 0,
    scanned_brands: 0,
    scanned_manufacturers: 0,
    notifications_created: 0,
    duplicates_skipped: 0,
    errors: [],
  };

  // 3. Récupère tous les centres d'intérêt actifs
  const { data: interests, error: intErr } = await supabase
    .from("vendor_catalog_interests")
    .select("id, vendor_id, manufacturer_id, brand_id, category_id, notify_new_product, notify_new_brand");
  if (intErr) {
    return new Response(JSON.stringify({ error: intErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!interests || interests.length === 0) {
    return new Response(JSON.stringify({ ...result, message: "No interests" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ----- Helpers -----
  async function alreadyDispatched(
    vendorId: string,
    sourceType: string,
    sourceId: string
  ): Promise<boolean> {
    const { data } = await supabase
      .from("vendor_notification_dispatch_log")
      .select("id")
      .eq("vendor_id", vendorId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .maybeSingle();
    return !!data;
  }

  async function dispatch(
    vendorId: string,
    interestId: string,
    sourceType: "product" | "brand" | "manufacturer",
    sourceId: string,
    title: string,
    bodyText: string,
    ctaUrl: string
  ) {
    if (await alreadyDispatched(vendorId, sourceType, sourceId)) {
      result.duplicates_skipped += 1;
      return;
    }
    if (dryRun) {
      result.notifications_created += 1;
      return;
    }
    const { data: notif, error: nErr } = await supabase
      .from("vendor_notifications")
      .insert({
        vendor_id: vendorId,
        type: `catalog.new_${sourceType}`,
        title,
        body: bodyText,
        cta_url: ctaUrl,
        payload: { source_type: sourceType, source_id: sourceId, interest_id: interestId },
      })
      .select("id")
      .single();
    if (nErr) {
      result.errors.push(`notif ${sourceType}/${sourceId}: ${nErr.message}`);
      return;
    }
    const { error: lErr } = await supabase
      .from("vendor_notification_dispatch_log")
      .insert({
        vendor_id: vendorId,
        source_type: sourceType,
        source_id: sourceId,
        interest_id: interestId,
        notification_id: notif.id,
      });
    if (lErr) {
      result.errors.push(`log ${sourceType}/${sourceId}: ${lErr.message}`);
    } else {
      result.notifications_created += 1;
    }
  }

  // 4. Nouveaux produits récemment approuvés
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, brand_id, manufacturer_id, category_id, submission_approved_at, created_at")
    .eq("is_active", true)
    .or(`submission_approved_at.gte.${since},and(submission_approved_at.is.null,created_at.gte.${since})`)
    .limit(1000);

  result.scanned_products = products?.length ?? 0;

  for (const p of products ?? []) {
    for (const i of interests) {
      if (!i.notify_new_product) continue;
      const matches =
        (i.manufacturer_id && i.manufacturer_id === p.manufacturer_id) ||
        (i.brand_id && i.brand_id === p.brand_id) ||
        (i.category_id && i.category_id === p.category_id);
      if (!matches) continue;
      await dispatch(
        i.vendor_id,
        i.id,
        "product",
        p.id,
        `Nouveau produit dans votre périmètre : ${p.name}`,
        `Un nouveau produit "${p.name}" vient d'être ajouté au catalogue MediKong. Créez votre offre dès maintenant.`,
        `/vendor/offers?action=create&product=${p.id}`
      );
    }
  }

  // 5. Nouvelles marques récemment approuvées
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug, submission_approved_at, created_at")
    .eq("is_active", true)
    .or(`submission_approved_at.gte.${since},and(submission_approved_at.is.null,created_at.gte.${since})`)
    .limit(500);

  result.scanned_brands = brands?.length ?? 0;

  for (const b of brands ?? []) {
    for (const i of interests) {
      if (!i.notify_new_brand) continue;
      // Une marque peut intéresser un vendeur uniquement via category (impossible direct) ou une autre brand : ici on ne notifie que si l'intérêt est lui-même une marque (cas peu probable) — on garde le hook ouvert pour les fabricants.
      // Notification large : tous les intérêts de type "manufacturer" dont la marque appartient => skip (pas de lien direct brand→manufacturer ici).
      if (!i.brand_id) continue;
      if (i.brand_id !== b.id) continue;
      await dispatch(
        i.vendor_id,
        i.id,
        "brand",
        b.id,
        `Marque ajoutée au catalogue : ${b.name}`,
        `La marque "${b.name}" rejoint MediKong. Préparez vos offres.`,
        `/marques/${b.slug ?? b.id}`
      );
    }
  }

  // 6. Nouveaux fabricants récemment approuvés
  const { data: manufacturers } = await supabase
    .from("manufacturers")
    .select("id, name, slug, submission_approved_at, created_at")
    .eq("is_active", true)
    .or(`submission_approved_at.gte.${since},and(submission_approved_at.is.null,created_at.gte.${since})`)
    .limit(500);

  result.scanned_manufacturers = manufacturers?.length ?? 0;

  for (const m of manufacturers ?? []) {
    for (const i of interests) {
      if (!i.notify_new_brand) continue;
      if (!i.manufacturer_id) continue;
      if (i.manufacturer_id !== m.id) continue;
      await dispatch(
        i.vendor_id,
        i.id,
        "manufacturer",
        m.id,
        `Fabricant ajouté au catalogue : ${m.name}`,
        `Le fabricant "${m.name}" rejoint MediKong.`,
        `/fabricants/${m.slug ?? m.id}`
      );
    }
  }

  return new Response(JSON.stringify({ ...result, dryRun, lookbackDays }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
