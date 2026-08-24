// @ts-nocheck — Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fmtEur(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency })
    .format((cents || 0) / 100)
    .replace(/\u202F/g, ".");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const quoteId = body?.quote_id;
    const recipientEmailOverride = body?.recipient_email;
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "quote_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: claims.claims.sub });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: quote, error: qErr } = await adminClient
      .from("quotes")
      .select("*, customer:customers(company_name, email), vendor:vendors(name, company_name)")
      .eq("id", quoteId)
      .maybeSingle();
    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: "quote not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!quote.public_token) {
      return new Response(JSON.stringify({ error: "missing public_token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const recipient = recipientEmailOverride || quote.customer?.email;
    if (!recipient) {
      return new Response(JSON.stringify({ error: "no recipient email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Génère (ou régénère) le PDF en best-effort
    let pdfUrl: string | undefined;
    try {
      const pdfResp = await adminClient.functions.invoke("generate-quote-pdf", {
        body: { quote_id: quoteId },
        headers: { Authorization: authHeader },
      });
      pdfUrl = (pdfResp.data as any)?.pdf_url;
    } catch (e) {
      console.warn("PDF generation failed, sending email without PDF link", e);
    }

    const publicOrigin = body?.public_origin || "https://medikong.pro";
    const publicUrl = `${publicOrigin}/devis/${quote.public_token}`;

    const validUntil = quote.token_expires_at
      ? new Date(quote.token_expires_at).toLocaleDateString("fr-BE")
      : undefined;

    const sendResp = await adminClient.functions.invoke("send-app-email", {
      body: {
        templateName: "quote-sent",
        recipientEmail: recipient,
        idempotencyKey: `quote-sent-${quote.id}-${quote.sent_at ?? "first"}`,
        templateData: {
          quoteNumber: quote.quote_number,
          vendorName: quote.vendor?.company_name || quote.vendor?.name,
          customerName: quote.customer?.company_name,
          totalTtcEur: fmtEur(Number(quote.total_ttc_cents) || 0, quote.currency_code),
          validUntil,
          publicUrl,
          pdfUrl,
          messageCustomer: quote.notes_customer ?? undefined,
        },
      },
    });

    if (sendResp.error) {
      return new Response(JSON.stringify({ error: "email_failed", details: sendResp.error }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Marque sent
    await adminClient.from("quotes")
      .update({ sent_at: new Date().toISOString(), status: quote.status === "draft" ? "sent" : quote.status })
      .eq("id", quote.id);

    return new Response(JSON.stringify({
      ok: true,
      sent_to: recipient,
      public_url: publicUrl,
      pdf_url: pdfUrl,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-quote-email error", e);
    return new Response(JSON.stringify({ error: "internal", message: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
