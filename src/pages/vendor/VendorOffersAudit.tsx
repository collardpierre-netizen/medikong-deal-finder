import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { AlertTriangle, CheckCircle2, ExternalLink, Pencil, Loader2, ArrowLeft } from "lucide-react";

type Severity = "error" | "warning";
interface Issue {
  code: string;
  label: string;
  detail: string;
  severity: Severity;
}

const ALL_COUNTRIES = ["BE", "FR", "NL", "LU", "DE"];

function detectIssues(offer: any, vendorApproved: boolean, vendorActive: boolean): Issue[] {
  const issues: Issue[] = [];
  const countryCodes: string[] = Array.isArray(offer.country_codes) && offer.country_codes.length > 0
    ? offer.country_codes
    : (offer.country_code ? [offer.country_code] : []);

  if (countryCodes.length === 0) {
    issues.push({ code: "no_country", label: "Aucun pays de livraison", detail: "L'offre n'est visible dans aucun pays. Cochez au moins BE.", severity: "error" });
  } else if (!countryCodes.includes("BE")) {
    const missing = ALL_COUNTRIES.filter(c => !countryCodes.includes(c)).join(", ");
    issues.push({ code: "restricted_country", label: "Visibilité restreinte", detail: `Livraison uniquement vers ${countryCodes.join(", ")}. Acheteurs invisibles : ${missing}.`, severity: "warning" });
  } else if (countryCodes.length < ALL_COUNTRIES.length) {
    const missing = ALL_COUNTRIES.filter(c => !countryCodes.includes(c)).join(", ");
    issues.push({ code: "partial_country", label: "Certains pays exclus", detail: `Non visible pour les acheteurs en ${missing}.`, severity: "warning" });
  }

  if (Number(offer.price_excl_vat) <= 0) {
    issues.push({ code: "no_price", label: "Prix HTVA à 0", detail: "L'offre est active mais sans prix — les acheteurs ne peuvent pas commander.", severity: "error" });
  }
  if (offer.stock_quantity != null && Number(offer.stock_quantity) <= 0) {
    issues.push({ code: "no_stock", label: "Stock épuisé", detail: "Stock à 0 — l'offre est masquée côté acheteur.", severity: "error" });
  }
  if (offer.products?.is_active === false) {
    issues.push({ code: "product_inactive", label: "Produit désactivé", detail: "Le produit lié est masqué du catalogue MediKong. Contactez le support.", severity: "error" });
  }
  if (!vendorApproved) {
    issues.push({ code: "vendor_not_approved", label: "KYC vendeur non validé", detail: "Vos offres restent invisibles tant que votre compte n'est pas approuvé.", severity: "error" });
  }
  if (!vendorActive) {
    issues.push({ code: "vendor_inactive", label: "Compte vendeur désactivé", detail: "Contactez MediKong pour réactiver votre compte.", severity: "error" });
  }
  if (offer.moq != null && Number(offer.moq) > 1 && offer.stock_quantity != null && Number(offer.stock_quantity) < Number(offer.moq)) {
    issues.push({ code: "stock_below_moq", label: "Stock inférieur au MOQ", detail: `Stock ${offer.stock_quantity} < MOQ ${offer.moq} : aucun acheteur ne peut atteindre la quantité minimale.`, severity: "error" });
  }
  return issues;
}

export default function VendorOffersAudit() {
  const { data: vendor } = useCurrentVendor();
  const [filter, setFilter] = useState<"all" | "issues" | "errors">("issues");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-offers-audit", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const [{ data: offers }, { data: vendorRow }] = await Promise.all([
        supabase
          .from("offers")
          .select("id, price_excl_vat, stock_quantity, moq, country_code, country_codes, is_active, updated_at, product_id, products(id, name, is_active, gtin, cnk_code)")
          .eq("vendor_id", vendor!.id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(2000),
        supabase.from("vendors").select("is_active, kyc_status").eq("id", vendor!.id).maybeSingle(),
      ]);
      return { offers: offers || [], vendorRow };
    },
  });

  const vendorApproved = data?.vendorRow
    ? ["approved", "accepted", "verified"].includes(String(data.vendorRow.kyc_status || "").toLowerCase())
    : true;
  const vendorActive = data?.vendorRow ? data.vendorRow.is_active !== false : true;

  const rows = useMemo(() => {
    return (data?.offers || []).map((o: any) => ({
      offer: o,
      issues: detectIssues(o, vendorApproved, vendorActive),
    }));
  }, [data, vendorApproved, vendorActive]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "errors") return rows.filter(r => r.issues.some(i => i.severity === "error"));
    return rows.filter(r => r.issues.length > 0);
  }, [rows, filter]);

  const stats = useMemo(() => ({
    total: rows.length,
    withIssues: rows.filter(r => r.issues.length > 0).length,
    withErrors: rows.filter(r => r.issues.some(i => i.severity === "error")).length,
    clean: rows.filter(r => r.issues.length === 0).length,
  }), [rows]);

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <Link to="/vendor/offers" className="inline-flex items-center gap-1 text-[12px] text-[#8B95A5] hover:text-[#1B5BDA] mb-1">
            <ArrowLeft size={12} /> Retour aux offres
          </Link>
          <h1 className="text-[22px] font-semibold" style={{ color: "#1D2530" }}>Audit visibilité des offres</h1>
          <p className="text-[12px]" style={{ color: "#8B95A5" }}>
            Liste toutes vos offres actives et signale automatiquement pourquoi certaines ne s'affichent pas côté acheteur.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Offres actives", value: stats.total, color: "#1D2530" },
          { label: "100 % visibles", value: stats.clean, color: "#16A34A" },
          { label: "Avec alerte", value: stats.withIssues, color: "#D97706" },
          { label: "Bloquées", value: stats.withErrors, color: "#DC2626" },
        ].map((s) => (
          <VCard key={s.label} className="p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#8B95A5" }}>{s.label}</div>
            <div className="text-[22px] font-semibold mt-1" style={{ color: s.color }}>{s.value}</div>
          </VCard>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        {[
          { key: "issues", label: `À revoir (${stats.withIssues})` },
          { key: "errors", label: `Bloquées (${stats.withErrors})` },
          { key: "all", label: `Toutes (${stats.total})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium border"
            style={{
              backgroundColor: filter === f.key ? "#1B5BDA" : "#fff",
              color: filter === f.key ? "#fff" : "#1D2530",
              borderColor: filter === f.key ? "#1B5BDA" : "#E2E8F0",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-8 justify-center text-[13px]" style={{ color: "#8B95A5" }}>
          <Loader2 className="animate-spin" size={16} /> Analyse en cours…
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <VCard className="p-6 text-center">
          <CheckCircle2 className="mx-auto mb-2" size={28} style={{ color: "#16A34A" }} />
          <p className="text-[13px] font-medium" style={{ color: "#1D2530" }}>
            {filter === "all" ? "Aucune offre active." : "Aucune offre à revoir. Tout est visible côté acheteur."}
          </p>
        </VCard>
      )}

      {!isLoading && filtered.length > 0 && (
        <VCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead style={{ backgroundColor: "#F8FAFC" }}>
                <tr className="text-left" style={{ color: "#8B95A5" }}>
                  <th className="py-2 px-3 font-medium">Produit</th>
                  <th className="py-2 px-3 font-medium">Prix HT</th>
                  <th className="py-2 px-3 font-medium">Stock</th>
                  <th className="py-2 px-3 font-medium">Pays</th>
                  <th className="py-2 px-3 font-medium">Diagnostic</th>
                  <th className="py-2 px-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ offer, issues }) => {
                  const cc = Array.isArray(offer.country_codes) && offer.country_codes.length > 0
                    ? offer.country_codes
                    : (offer.country_code ? [offer.country_code] : []);
                  const hasError = issues.some(i => i.severity === "error");
                  return (
                    <tr key={offer.id} className="border-t align-top" style={{ borderColor: "#F1F5F9" }}>
                      <td className="py-2.5 px-3">
                        <div className="font-medium" style={{ color: "#1D2530" }}>{offer.products?.name || "—"}</div>
                        <div className="text-[10px]" style={{ color: "#8B95A5" }}>
                          {offer.products?.gtin && <>EAN {offer.products.gtin}</>}
                          {offer.products?.gtin && offer.products?.cnk_code && " · "}
                          {offer.products?.cnk_code && <>CNK {offer.products.cnk_code}</>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{Number(offer.price_excl_vat).toFixed(2)} €</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{offer.stock_quantity ?? "—"}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {cc.length === 0 ? <span style={{ color: "#DC2626" }}>—</span> : cc.map((c: string) => (
                            <span key={c} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "#EEF2FF", color: "#1B5BDA" }}>{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {issues.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "#16A34A" }}>
                            <CheckCircle2 size={12} /> Visible partout
                          </span>
                        ) : (
                          <ul className="space-y-1">
                            {issues.map((i) => (
                              <li key={i.code} className="flex items-start gap-1.5">
                                <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: i.severity === "error" ? "#DC2626" : "#D97706" }} />
                                <div>
                                  <div className="font-medium" style={{ color: i.severity === "error" ? "#991B1B" : "#9A3412" }}>
                                    {i.label}
                                  </div>
                                  <div className="text-[10px]" style={{ color: "#8B95A5" }}>{i.detail}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Link
                          to={`/vendor/offers?edit=${offer.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border"
                          style={{
                            borderColor: hasError ? "#DC2626" : "#1B5BDA",
                            color: hasError ? "#DC2626" : "#1B5BDA",
                            backgroundColor: "#fff",
                          }}
                        >
                          <Pencil size={11} /> Éditer
                          <ExternalLink size={10} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </VCard>
      )}
    </div>
  );
}
