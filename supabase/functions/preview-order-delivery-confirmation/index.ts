// Admin-only: renders the order-delivery-confirmation email template as HTML,
// so admins can preview the exact rendering without sending an actual email.
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "npm:@supabase/supabase-js@2";
import { TEMPLATES } from "../_shared/transactional-email-templates/registry.ts";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireAdminOrService(req);
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), {
      status: guard.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId") || "";

  const entry = TEMPLATES["order-delivery-confirmation"];
  if (!entry) {
    return new Response("Template not found", { status: 404, headers: corsHeaders });
  }

  let templateData: Record<string, unknown> = { ...(entry.previewData || {}) };

  if (orderId) {
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: order } = await admin
        .from("orders")
        .select("id, order_number, customer_id")
        .eq("id", orderId)
        .maybeSingle();
      if (order) {
        const { data: customer } = await admin
          .from("customers")
          .select("company_name")
          .eq("id", order.customer_id)
          .maybeSingle();
        const { data: lines } = await admin
          .from("order_lines")
          .select("id")
          .eq("order_id", order.id);
        const origin = req.headers.get("origin") || "https://medikong.pro";
        templateData = {
          orderNumber: order.order_number,
          customerName: customer?.company_name || undefined,
          confirmUrl: `${origin.replace(/\/$/, "")}/commande/confirmer/PREVIEW-TOKEN`,
          lineCount: (lines ?? []).length || 1,
        };
      }
    } catch (_e) {
      // fall back to previewData
    }
  }

  try {
    const html = await renderAsync(
      React.createElement(entry.component as any, templateData),
    );
    const subject =
      typeof entry.subject === "function" ? entry.subject(templateData) : entry.subject;
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "X-Email-Subject": encodeURIComponent(subject || ""),
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
