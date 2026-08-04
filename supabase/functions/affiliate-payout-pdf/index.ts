// @ts-nocheck — Deno runtime
// Note de commission apporteur (auto-facturation MediKong).
// Accès : l'apporteur concerné ou un admin. Génère le PDF, l'archive et renvoie une URL signée.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { jsPDF } from "npm:jspdf@2.5.2";
import { MEDIKONG_LOGO_PNG_BASE64 } from "../_shared/medikong-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "order-pdfs";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;
const VAT_RATE_BP = 2100;

// Coordonnées légales MediKong (Balooh SRL renommée MediKong).
const ISSUER = {
  name: "MediKong SRL",
  address: "23 rue de la Procession, 7822 Ath, Belgique",
  vat: "BE 1005.771.323",
};

function fmtEur(cents: number): string {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" })
    .format((cents || 0) / 100)
    .replace(/\u202F/g, ".");
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const VAT_LABEL: Record<string, string> = {
  none: "Hors champ TVA",
  vat_21: "TVA 21 %",
  reverse_charge: "Autoliquidation — TVA due par le preneur (art. 21 §2 C.TVA)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims?.sub) return json(401, { error: "Unauthorized" });
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const payoutId = String(body?.payout_id ?? "");
    if (!payoutId) return json(400, { error: "payout_id requis" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: payout, error: pErr } = await admin
      .from("affiliate_payout_invoices")
      .select("id, affiliate_id, invoice_number, period_start, period_end, total_cents, vat_mode, status, pdf_path, issued_at, paid_at")
      .eq("id", payoutId)
      .maybeSingle();
    if (pErr || !payout) return json(404, { error: "Note introuvable" });

    const { data: affiliate } = await admin
      .from("affiliates")
      .select("id, user_id, affiliate_code, display_name, company_name, email, vat_number, iban")
      .eq("id", payout.affiliate_id)
      .maybeSingle();

    // Autorisation : apporteur propriétaire OU admin.
    let allowed = affiliate?.user_id === userId;
    if (!allowed) {
      const { data: isAdmin } = await userClient.rpc("is_admin");
      allowed = Boolean(isAdmin);
    }
    if (!allowed) return json(403, { error: "Acces refuse" });

    const { data: lines } = await admin
      .from("affiliate_commissions")
      .select("id, order_id, order_total_ht_cents, commission_cents, created_at")
      .eq("payout_invoice_id", payoutId)
      .order("created_at", { ascending: true });

    const orderIds = (lines ?? []).map((l) => l.order_id).filter(Boolean);
    const orderNumbers: Record<string, string> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await admin
        .from("orders")
        .select("id, order_number, created_at")
        .in("id", orderIds);
      for (const o of orders ?? []) orderNumbers[o.id] = o.order_number ?? "";
    }

    const htCents = Number(payout.total_cents) || 0;
    const vatCents = payout.vat_mode === "vat_21" ? Math.round((htCents * VAT_RATE_BP) / 10000) : 0;
    const totalCents = htCents + vatCents;

    // --- Rendu PDF ---
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    let y = 14;

    try { doc.addImage(MEDIKONG_LOGO_PNG_BASE64, "PNG", 14, y, 42, 12); } catch { /* logo optionnel */ }

    doc.setFontSize(15);
    doc.text("Note de commission", W - 14, y + 6, { align: "right" });
    doc.setFontSize(9);
    doc.text("Auto-facturation établie par MediKong", W - 14, y + 12, { align: "right" });
    y += 26;

    doc.setFontSize(9);
    doc.text([ISSUER.name, ISSUER.address, `TVA ${ISSUER.vat}`], 14, y);
    doc.text(
      [
        "Bénéficiaire",
        affiliate?.company_name || affiliate?.display_name || "",
        affiliate?.vat_number ? `TVA ${affiliate.vat_number}` : "TVA : non communiquée",
        affiliate?.iban ? `IBAN ${affiliate.iban}` : "IBAN : non communiqué",
      ].filter(Boolean),
      W / 2,
      y,
    );
    y += 26;

    doc.setFontSize(10);
    doc.text(`Numéro : ${payout.invoice_number ?? "—"}`, 14, y);
    doc.text(`Période : ${fmtDate(payout.period_start)} → ${fmtDate(payout.period_end)}`, 14, y + 5);
    doc.text(`Émission : ${fmtDate(payout.issued_at ?? payout.period_end)}`, 14, y + 10);
    doc.text(`Code apporteur : ${affiliate?.affiliate_code ?? "—"}`, W - 14, y, { align: "right" });
    doc.text(`Régime TVA : ${VAT_LABEL[payout.vat_mode] ?? payout.vat_mode}`, W - 14, y + 5, { align: "right" });
    y += 20;

    // Tableau des commissions
    doc.setFillColor(240, 242, 245);
    doc.rect(14, y - 5, W - 28, 8, "F");
    doc.setFontSize(9);
    doc.text("Commande", 16, y);
    doc.text("Date", 60, y);
    doc.text("Montant HTVA", 130, y, { align: "right" });
    doc.text("Commission", W - 16, y, { align: "right" });
    y += 8;

    for (const l of lines ?? []) {
      if (y > 262) { doc.addPage(); y = 20; }
      doc.text(orderNumbers[l.order_id] || "—", 16, y);
      doc.text(fmtDate(l.created_at), 60, y);
      doc.text(fmtEur(l.order_total_ht_cents), 130, y, { align: "right" });
      doc.text(fmtEur(l.commission_cents), W - 16, y, { align: "right" });
      y += 6;
    }
    if ((lines ?? []).length === 0) {
      doc.text("Aucune ligne de commission rattachée.", 16, y);
      y += 6;
    }

    y += 6;
    doc.line(120, y, W - 14, y);
    y += 6;
    doc.text("Total HTVA", 150, y, { align: "right" });
    doc.text(fmtEur(htCents), W - 16, y, { align: "right" });
    y += 6;
    doc.text("TVA", 150, y, { align: "right" });
    doc.text(fmtEur(vatCents), W - 16, y, { align: "right" });
    y += 6;
    doc.setFontSize(11);
    doc.text("Total à payer", 150, y, { align: "right" });
    doc.text(fmtEur(totalCents), W - 16, y, { align: "right" });

    y += 14;
    doc.setFontSize(8);
    doc.text(
      [
        "Document établi par MediKong pour le compte du bénéficiaire dans le cadre d'un mandat d'auto-facturation.",
        payout.vat_mode === "reverse_charge"
          ? "TVA non appliquée : autoliquidation par le preneur (art. 21 §2 du Code de la TVA)."
          : payout.vat_mode === "none"
            ? "Opération hors champ de la TVA."
            : "TVA belge de 21 % appliquée sur les commissions.",
        payout.paid_at ? `Réglée par virement le ${fmtDate(payout.paid_at)}.` : "Règlement par virement sur l'IBAN communiqué.",
      ],
      14,
      y,
    );

    const bytes = new Uint8Array(doc.output("arraybuffer"));
    const pdfPath = `affiliate-payouts/${payout.affiliate_id}/${payout.invoice_number ?? payout.id}.pdf`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(pdfPath, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return json(500, { error: `Upload échoué : ${upErr.message}` });

    if (payout.pdf_path !== pdfPath) {
      await admin.from("affiliate_payout_invoices").update({ pdf_path: pdfPath }).eq("id", payoutId);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(pdfPath, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) return json(500, { error: "URL signée indisponible" });

    return json(200, { ok: true, url: signed.signedUrl, path: pdfPath });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Erreur inconnue" });
  }
});
