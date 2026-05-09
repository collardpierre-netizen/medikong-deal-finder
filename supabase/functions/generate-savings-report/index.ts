// Edge function: generate-savings-report
// Generates a PDF savings report, uploads it to the private `savings-reports`
// bucket, creates a 30-day signed URL and triggers a transactional email.
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.1";
import autoTable from "npm:jspdf-autotable@3.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SUPPLIER_LABEL: Record<string, string> = {
  febelco: "Febelco",
  cerp: "CERP",
  pharma_belgium: "Pharma Belgium",
  other: "votre grossiste",
};

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));
const fmtPct = (n: number | null | undefined) =>
  typeof n === "number" ? `${Number(n).toFixed(1)} %` : "—";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let simulation_id: string;
  try {
    const body = await req.json();
    simulation_id = body.simulation_id;
    if (!simulation_id) throw new Error("simulation_id required");
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Load simulation + lines
  const { data: sim, error: simErr } = await supabase
    .from("savings_simulations").select("*").eq("id", simulation_id).maybeSingle();
  if (simErr || !sim) {
    return new Response(JSON.stringify({ error: "simulation_not_found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (sim.status !== "done") {
    return new Response(JSON.stringify({ error: "simulation_not_ready", status: sim.status }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: lines } = await supabase
    .from("savings_simulation_lines")
    .select("line_number,detected_name,detected_cnk,detected_quantity,detected_unit_price_excl_vat,medikong_min_price_excl_vat,line_savings,match_method")
    .eq("simulation_id", simulation_id)
    .order("line_savings", { ascending: false, nullsFirst: false })
    .limit(500);

  const supplierLabel = SUPPLIER_LABEL[sim.source_supplier] ?? "votre grossiste";

  // 2. Build PDF
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header band
  doc.setFillColor(28, 88, 217); // primary blue
  doc.rect(0, 0, pageWidth, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text("MediKong — Rapport d'économies", margin, 35);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text(`Simulation ${supplierLabel} · ${new Date(sim.created_at).toLocaleDateString("fr-BE")}`, margin, 58);

  // Pharmacy info
  let y = 110;
  doc.setTextColor(30, 37, 47);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(sim.pharmacy_name || "Votre pharmacie", margin, y);
  doc.setFont("helvetica", "normal");
  if (sim.city) doc.text(sim.city, margin, (y += 14));
  if (sim.vat_number) doc.text(`TVA ${sim.vat_number}`, margin, (y += 14));

  // Hero box (savings)
  y += 20;
  doc.setFillColor(244, 248, 255);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 80, 8, 8, "F");
  doc.setFontSize(10); doc.setTextColor(100, 110, 120);
  doc.text("Économies potentielles annualisées", margin + 16, y + 22);
  doc.setFontSize(28); doc.setTextColor(22, 163, 74); doc.setFont("helvetica", "bold");
  doc.text(fmtMoney(sim.savings_amount), margin + 16, y + 55);
  doc.setFontSize(11); doc.setTextColor(100, 110, 120); doc.setFont("helvetica", "normal");
  doc.text(`soit ${fmtPct(sim.savings_pct)} de votre facture ${supplierLabel}`, margin + 16, y + 72);
  y += 100;

  // Summary table
  doc.setFontSize(12); doc.setTextColor(30, 37, 47); doc.setFont("helvetica", "bold");
  doc.text("Synthèse", margin, y); y += 8;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Indicateur", "Valeur"]],
    body: [
      ["Lignes analysées", `${sim.matched_lines} / ${sim.total_lines} (${fmtPct((Number(sim.match_rate ?? 0)) * 100)})`],
      [`Total ${supplierLabel} (HTVA)`, fmtMoney(sim.source_total_excl_vat)],
      ["Total MediKong (HTVA)", fmtMoney(sim.medikong_total_excl_vat)],
      ["Économie estimée", fmtMoney(sim.savings_amount)],
    ],
    headStyles: { fillColor: [30, 37, 47], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 6 },
  });

  // Lines detail
  // @ts-ignore lastAutoTable injected by autotable
  y = (doc as any).lastAutoTable.finalY + 24;
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text("Détail des économies par ligne", margin, y); y += 6;

  const rows = (lines ?? []).map((l) => [
    String(l.line_number ?? ""),
    (l.detected_name ?? "—").slice(0, 50),
    l.detected_cnk ?? "",
    l.detected_quantity != null ? String(l.detected_quantity) : "",
    l.detected_unit_price_excl_vat != null ? fmtMoney(l.detected_unit_price_excl_vat) : "—",
    l.medikong_min_price_excl_vat != null ? fmtMoney(l.medikong_min_price_excl_vat) : "—",
    l.line_savings != null ? fmtMoney(l.line_savings) : "—",
  ]);

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["#", "Produit", "CNK", "Qté", `${supplierLabel}`, "MediKong", "Économie"]],
    body: rows,
    headStyles: { fillColor: [28, 88, 217], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 24 }, 1: { cellWidth: 180 }, 2: { cellWidth: 56 },
      3: { cellWidth: 32, halign: "right" }, 4: { halign: "right" },
      5: { halign: "right" }, 6: { halign: "right", textColor: [22, 163, 74], fontStyle: "bold" },
    },
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8); doc.setTextColor(150, 155, 165);
      doc.text(
        "MediKong — Balooh SRL · 23 rue de la Procession · 7822 Ath · Belgique · Document confidentiel",
        margin, pageH - 20,
      );
    },
  });

  // 3. Upload PDF
  const pdfBytes = doc.output("arraybuffer");
  const path = `${sim.id}/medikong-economies-${sim.id.slice(0, 8)}.pdf`;

  const { error: upErr } = await supabase.storage
    .from("savings-reports")
    .upload(path, new Uint8Array(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "3600",
    });
  if (upErr) {
    console.error("upload failed", upErr);
    return new Response(JSON.stringify({ error: "upload_failed", details: upErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Signed URL 30 days
  const { data: signed, error: signErr } = await supabase.storage
    .from("savings-reports").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed) {
    return new Response(JSON.stringify({ error: "sign_failed", details: signErr?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 5. Update simulation
  await supabase.from("savings_simulations").update({ report_path: path }).eq("id", sim.id);

  // 6. Send email (best-effort)
  let emailSent = false;
  if (sim.email) {
    try {
      const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "wholesale-savings-report",
          recipientEmail: sim.email,
          idempotencyKey: `savings-report-${sim.id}`,
          templateData: {
            pharmacyName: sim.pharmacy_name || "votre pharmacie",
            supplierLabel,
            totalLines: sim.total_lines,
            matchedLines: sim.matched_lines,
            matchRatePct: Number(sim.match_rate ?? 0) * 100,
            sourceTotal: fmtMoney(sim.source_total_excl_vat),
            medikongTotal: fmtMoney(sim.medikong_total_excl_vat),
            savingsAmount: fmtMoney(sim.savings_amount),
            savingsPct: Number(sim.savings_pct ?? 0),
            reportUrl: signed.signedUrl,
            signupUrl: `https://medikong.pro/onboarding?ref=savings-${sim.id.slice(0, 8)}`,
            deleteUrl: `https://medikong.pro/economies/supprimer/${sim.id}`,
            expiresInDays: 30,
          },
        },
      });
      if (mailErr) console.error("email invoke failed", mailErr);
      else emailSent = true;
      if (emailSent) {
        await supabase.from("savings_simulations")
          .update({ email_sent_at: new Date().toISOString() }).eq("id", sim.id);
      }
    } catch (e) { console.error("email exception", e); }
  }

  return new Response(JSON.stringify({
    success: true, report_path: path, signed_url: signed.signedUrl, email_sent: emailSent,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
