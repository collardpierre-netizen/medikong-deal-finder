// @ts-nocheck — Deno runtime
// Returns a 7-day signed URL for an invoice PDF.
// Payload: { invoice_id }
// Access rules:
//  - admin: any invoice
//  - vendor (auth_user_id matches vendor): own invoices (both types)
//  - customer (owner of the order): only type='self_billing'
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "invoices";
const TTL_SECONDS = 60 * 60 * 24 * 7;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const user = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await user.auth.getClaims(authHeader.replace("Bearer ", ""));
    const uid = claims?.claims?.sub;
    if (!uid) return json(401, { error: "unauthorized" });

    const supabase = createClient(supabaseUrl, svc);
    const body = await req.json().catch(() => ({}));
    const invoiceId = body?.invoice_id as string;
    if (!invoiceId) return json(400, { error: "invoice_id_required" });

    const { data: inv } = await supabase
      .from("order_invoices")
      .select("id, order_id, vendor_id, type, pdf_path, invoice_number")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv || !inv.pdf_path) return json(404, { error: "invoice_not_found" });

    // Authorization checks
    const { data: adm } = await supabase.rpc("is_admin", { _user_id: uid });
    let allowed = !!adm;
    if (!allowed) {
      const { data: vendorRow } = await supabase
        .from("vendors").select("id").eq("id", inv.vendor_id).eq("auth_user_id", uid).maybeSingle();
      if (vendorRow) allowed = true;
    }
    if (!allowed && inv.type === "self_billing") {
      const { data: ord } = await supabase
        .from("orders").select("customer_id, customers!orders_customer_id_fkey(auth_user_id)").eq("id", inv.order_id).maybeSingle();
      if (ord?.customers?.auth_user_id === uid) allowed = true;
    }
    if (!allowed) return json(403, { error: "forbidden" });

    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(inv.pdf_path, TTL_SECONDS, { download: `${inv.invoice_number}.pdf` });
    if (error) return json(500, { error: "sign_failed", details: error.message });

    return json(200, { ok: true, signed_url: signed.signedUrl, invoice_number: inv.invoice_number, type: inv.type });
  } catch (e) {
    console.error("[get-invoice-signed-url]", e);
    return json(500, { error: "internal_error", details: String(e?.message || e) });
  }
});
