import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import {
  Inbox, Tag, Loader2, Clock, Package, MapPin, Calendar,
  CheckCircle2, XCircle, AlertCircle, Bell, FileDown, Eye, FileText,
  Image as ImageIcon, FileSpreadsheet, File as FileIcon, X,
} from "lucide-react";
import { formatUpdatedAt, formatUpdatedAtFull } from "@/lib/format-date";
import { useMoneyFormat, formatMoneyFromCents } from "@/lib/money-format";
import { VendorRfqResponseForm } from "@/components/vendor/VendorRfqResponseForm";
import { Helmet } from "react-helmet-async";

type DispatchRow = {
  id: string;
  rfq_id: string;
  status: string;
  reason: string;
  dispatched_at: string;
  viewed_at: string | null;
  reminded_at: string | null;
  responded_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  tracking_token: string;
  rfq: {
    id: string;
    quantity: number;
    target_price_excl_vat_cents: number | null;
    desired_delivery_date: string | null;
    destination_country_code: string;
    status: string;
    responses_deadline: string | null;
    created_at: string;
    comment: string | null;
    payment_terms: string | null;
    required_offer_validity_days: number | null;
    target_scope: string;
    product_id: string | null;
    brand_id: string | null;
  } | null;
};

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  dispatched: { label: "Nouvelle", tone: "bg-blue-100 text-blue-700" },
  viewed: { label: "Consultée", tone: "bg-amber-100 text-amber-700" },
  pending_review: { label: "À traiter", tone: "bg-amber-100 text-amber-700" },
  reminded: { label: "Relancée", tone: "bg-orange-100 text-orange-700" },
  responded: { label: "Répondue", tone: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Déclinée", tone: "bg-slate-100 text-slate-600" },
  expired: { label: "Expirée", tone: "bg-red-100 text-red-700" },
  awarded: { label: "Gagnée 🏆", tone: "bg-emerald-200 text-emerald-800 font-semibold" },
  lost: { label: "Perdue", tone: "bg-slate-100 text-slate-600" },
};

const TAB_FILTERS = [
  { key: "todo", label: "À traiter", statuses: ["dispatched", "viewed", "pending_review", "reminded"] },
  { key: "answered", label: "Répondues", statuses: ["responded", "awarded", "lost"] },
  { key: "declined", label: "Déclinées / Expirées", statuses: ["declined", "expired"] },
  { key: "all", label: "Toutes", statuses: [] },
] as const;

function formatPriceCents(cents: number | null | undefined, locale?: string) {
  if (cents == null) return "—";
  return formatMoneyFromCents(cents, locale ? { locale } : undefined);
}

export default function VendorRfqInbox() {
  const { data: vendor } = useCurrentVendor();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRfq = searchParams.get("rfq");
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(initialRfq);
  const [tab, setTab] = useState<typeof TAB_FILTERS[number]["key"]>("todo");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-rfq-inbox", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_dispatch_log")
        .select(`
          id, rfq_id, status, reason, dispatched_at, viewed_at, reminded_at,
          responded_at, declined_at, decline_reason, tracking_token,
          rfq:rfqs!inner(
            id, quantity, target_price_excl_vat_cents, desired_delivery_date,
            destination_country_code, status, responses_deadline, created_at,
            comment, payment_terms, required_offer_validity_days, target_scope,
            product_id, brand_id
          )
        `)
        .eq("vendor_id", vendor!.id)
        .order("dispatched_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DispatchRow[];
    },
  });

  const productIds = useMemo(
    () => Array.from(new Set((data || []).map((d) => d.rfq?.product_id).filter(Boolean) as string[])),
    [data]
  );
  const brandIds = useMemo(
    () => Array.from(new Set((data || []).map((d) => d.rfq?.brand_id).filter(Boolean) as string[])),
    [data]
  );

  const { data: products } = useQuery({
    queryKey: ["vendor-rfq-products", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, slug, gtin, image_url").in("id", productIds);
      return data || [];
    },
  });
  const { data: brands } = useQuery({
    queryKey: ["vendor-rfq-brands", brandIds],
    enabled: brandIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name, slug").in("id", brandIds);
      return data || [];
    },
  });

  const productMap = useMemo(() => Object.fromEntries((products || []).map((p: any) => [p.id, p])), [products]);
  const brandMap = useMemo(() => Object.fromEntries((brands || []).map((b: any) => [b.id, b])), [brands]);

  const { data: existingResponses } = useQuery({
    queryKey: ["vendor-rfq-responses-mine", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("rfq_responses")
        .select("rfq_id, unit_price_excl_vat_cents, moq, delivery_days, offer_validity_days, payment_terms, comment, awarded, created_at, updated_at")
        .eq("vendor_id", vendor!.id);
      const map: Record<string, any> = {};
      for (const r of data || []) map[r.rfq_id] = r;
      return map;
    },
  });

  const filtered = useMemo(() => {
    const rows = data || [];
    const allowed = TAB_FILTERS.find((t) => t.key === tab)?.statuses || [];
    if (allowed.length === 0) return rows;
    return rows.filter((r) => (allowed as readonly string[]).includes(r.status));
  }, [data, tab]);

  const counters = useMemo(() => {
    const rows = data || [];
    return {
      todo: rows.filter((r) => ["dispatched", "viewed", "pending_review", "reminded"].includes(r.status)).length,
      answered: rows.filter((r) => ["responded", "awarded", "lost"].includes(r.status)).length,
      declined: rows.filter((r) => ["declined", "expired"].includes(r.status)).length,
      all: rows.length,
    };
  }, [data]);

  const selected = useMemo(
    () => (data || []).find((d) => d.rfq_id === selectedRfqId) || null,
    [data, selectedRfqId]
  );

  useEffect(() => {
    if (!selected || selected.viewed_at) return;
    supabase.functions.invoke("rfq-track", {
      body: { token: selected.tracking_token, event: "view" },
    }).catch(() => {/* silent */});
    setTimeout(() => qc.invalidateQueries({ queryKey: ["vendor-rfq-inbox", vendor?.id] }), 1500);
  }, [selected, qc, vendor?.id]);

  useEffect(() => {
    if (selectedRfqId) {
      searchParams.set("rfq", selectedRfqId);
    } else {
      searchParams.delete("rfq");
    }
    setSearchParams(searchParams, { replace: true });
  }, [selectedRfqId]);

  if (!vendor) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8B95A5]">
        <Loader2 className="animate-spin mr-2" size={16} /> Chargement du compte vendeur…
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Demandes de prix · Vendeur · MediKong</title></Helmet>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[#1D2530] flex items-center gap-2">
            <Inbox className="h-5 w-5 text-[#1C58D9]" /> Demandes de prix reçues
          </h1>
          <p className="text-[13px] text-[#616B7C] mt-0.5">
            Répondez rapidement aux demandes des acheteurs : prix, MOQ, délai de livraison.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#E2E8F0]">
          {TAB_FILTERS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-[#1C58D9] text-[#1C58D9]"
                  : "border-transparent text-[#616B7C] hover:text-[#1D2530]"
              }`}
            >
              {t.label}
              <span className="ml-1.5 inline-flex items-center justify-center text-[11px] bg-[#F1F5F9] rounded-full px-1.5 min-w-[20px]">
                {counters[t.key as keyof typeof counters]}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
          <div className="space-y-2">
            {isLoading && (
              <div className="flex items-center justify-center py-12 text-[#8B95A5]">
                <Loader2 className="animate-spin mr-2" size={16} /> Chargement…
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <VCard>
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Inbox size={36} className="text-[#CBD5E1] mb-3" />
                  <p className="font-medium text-[#1D2530]">Aucune demande dans cet onglet</p>
                  <p className="text-[12px] text-[#8B95A5] mt-1 max-w-xs">
                    Les nouvelles demandes apparaîtront ici dès qu'un acheteur ciblera votre catalogue.
                  </p>
                </div>
              </VCard>
            )}
            {filtered.map((row) => {
              const rfq = row.rfq!;
              const product = rfq.product_id ? productMap[rfq.product_id] : null;
              const brand = rfq.brand_id ? brandMap[rfq.brand_id] : null;
              const status = STATUS_LABELS[row.status] || { label: row.status, tone: "bg-slate-100 text-slate-600" };
              const isSel = selectedRfqId === row.rfq_id;
              const hasResponse = !!existingResponses?.[row.rfq_id];

              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedRfqId(row.rfq_id)}
                  className={`w-full text-left rounded-[12px] border p-3 transition-all ${
                    isSel
                      ? "border-[#1C58D9] bg-[#F0F6FF] shadow-sm"
                      : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.tone}`}>
                      {status.label}
                    </span>
                    {row.reminded_at && (
                      <span className="text-[10px] text-orange-600 inline-flex items-center gap-1">
                        <Bell size={10} /> Relancée
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-[#1D2530] line-clamp-2">
                    {product?.name || (brand ? `Marque · ${brand.name}` : "Demande de prix")}
                  </p>
                  {product?.gtin && (
                    <p className="text-[10px] text-[#8B95A5] mt-0.5">EAN: {product.gtin}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-[#616B7C] mt-2">
                    <span className="inline-flex items-center gap-1"><Package size={11} /> {rfq.quantity.toLocaleString("fr-BE")} u.</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={11} /> {rfq.destination_country_code}</span>
                    {rfq.desired_delivery_date && (
                      <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatUpdatedAt(rfq.desired_delivery_date)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-[#8B95A5]">
                    <span title={formatUpdatedAtFull(row.dispatched_at)}>Reçue {formatUpdatedAt(row.dispatched_at)}</span>
                    {hasResponse && (
                      <span className="text-emerald-700 inline-flex items-center gap-1 font-medium">
                        <CheckCircle2 size={11} /> Réponse envoyée
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            {!selected && (
              <VCard>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Tag size={36} className="text-[#CBD5E1] mb-3" />
                  <p className="font-medium text-[#1D2530]">Sélectionnez une demande</p>
                  <p className="text-[12px] text-[#8B95A5] mt-1">Le détail et le formulaire de réponse s'afficheront ici.</p>
                </div>
              </VCard>
            )}
            {selected && selected.rfq && (
              <RfqDetailPanel
                row={selected}
                product={selected.rfq.product_id ? productMap[selected.rfq.product_id] : null}
                brand={selected.rfq.brand_id ? brandMap[selected.rfq.brand_id] : null}
                existingResponse={existingResponses?.[selected.rfq_id] || null}
                vendorId={vendor.id}
                onAfter={() => {
                  qc.invalidateQueries({ queryKey: ["vendor-rfq-inbox", vendor.id] });
                  qc.invalidateQueries({ queryKey: ["vendor-rfq-responses-mine", vendor.id] });
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function RfqDetailPanel({
  row, product, brand, existingResponse, vendorId, onAfter,
}: {
  row: DispatchRow;
  product: any;
  brand: any;
  existingResponse: any;
  vendorId: string;
  onAfter: () => void;
}) {
  const rfq = row.rfq!;
  const { locale } = useMoneyFormat();
  const status = STATUS_LABELS[row.status] || { label: row.status, tone: "bg-slate-100 text-slate-600" };
  const deadlinePassed = rfq.responses_deadline && new Date(rfq.responses_deadline) < new Date();
  const canRespond = !deadlinePassed && !["declined", "expired", "lost"].includes(row.status);

  return (
    <div className="space-y-4">
      <VCard>
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.tone}`}>{status.label}</span>
            <h2 className="text-[16px] font-bold text-[#1D2530] mt-2">
              {product?.name || (brand ? `Marque · ${brand.name}` : "Demande de prix")}
            </h2>
            {product?.gtin && <p className="text-[11px] text-[#8B95A5] mt-0.5">EAN: {product.gtin}</p>}
          </div>
          {product?.image_url && (
            <img src={product.image_url} alt="" className="w-16 h-16 rounded-lg object-contain bg-[#F8FAFC] border border-[#E2E8F0]" />
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-[12px]">
          <Field label="Quantité demandée"><strong>{rfq.quantity.toLocaleString("fr-BE")}</strong> unités</Field>
          <Field label="Pays de livraison"><strong>{rfq.destination_country_code}</strong></Field>
          {rfq.target_price_excl_vat_cents != null && (
            <Field label="Prix cible HTVA">
              <strong>{formatPriceCents(rfq.target_price_excl_vat_cents)}</strong> /u.
            </Field>
          )}
          {rfq.desired_delivery_date && (
            <Field label="Livraison souhaitée">
              <strong>{formatUpdatedAt(rfq.desired_delivery_date)}</strong>
            </Field>
          )}
          {rfq.required_offer_validity_days && (
            <Field label="Validité d'offre demandée"><strong>{rfq.required_offer_validity_days}</strong> jours</Field>
          )}
          {rfq.payment_terms && <Field label="Conditions de paiement">{rfq.payment_terms}</Field>}
          {rfq.responses_deadline && (
            <Field label="Date limite de réponse">
              <strong className={deadlinePassed ? "text-red-600" : ""}>
                <Clock className="inline h-3 w-3 mr-0.5" /> {formatUpdatedAt(rfq.responses_deadline)}
              </strong>
            </Field>
          )}
        </dl>

        {rfq.comment && (
          <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#8B95A5] mb-1">Commentaire de l'acheteur</p>
            <p className="text-[13px] text-[#1D2530] whitespace-pre-wrap">{rfq.comment}</p>
          </div>
        )}
      </VCard>

      <RfqAttachmentsList rfqId={rfq.id} />

      {canRespond ? (
        <VendorRfqResponseForm
          rfqId={rfq.id}
          vendorId={vendorId}
          trackingToken={row.tracking_token}
          existingResponse={existingResponse}
          targetPriceCents={rfq.target_price_excl_vat_cents}
          requiredValidityDays={rfq.required_offer_validity_days}
          quantity={rfq.quantity}
          alreadyDeclined={row.status === "declined"}
          onAfter={onAfter}
        />
      ) : (
        <VCard>
          <div className="flex items-center gap-2 text-[13px] text-[#8B95A5]">
            <AlertCircle size={16} />
            {deadlinePassed
              ? "La date limite de réponse est dépassée."
              : row.status === "declined"
              ? "Vous avez décliné cette demande."
              : "Cette demande est clôturée."}
          </div>
        </VCard>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[#8B95A5] font-semibold mb-0.5">{label}</dt>
      <dd className="text-[#1D2530]">{children}</dd>
    </div>
  );
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

function AttachmentIcon({ mime }: { mime: string }) {
  if (mime?.startsWith("image/")) return <ImageIcon className="h-3.5 w-3.5" />;
  if (mime === "application/pdf") return <FileText className="h-3.5 w-3.5" />;
  if (mime?.includes("sheet") || mime?.includes("excel") || mime === "text/csv")
    return <FileSpreadsheet className="h-3.5 w-3.5" />;
  if (mime?.includes("word")) return <FileText className="h-3.5 w-3.5" />;
  return <FileIcon className="h-3.5 w-3.5" />;
}

function RfqAttachmentsList({ rfqId }: { rfqId: string }) {
  const [preview, setPreview] = useState<{ url: string; name: string; kind: "image" | "pdf" } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rfq-attachments-vendor", rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_attachments")
        .select("id, file_name, mime_type, size_bytes, storage_path, uploader_role")
        .eq("rfq_id", rfqId)
        .eq("uploader_role", "buyer");
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || (data || []).length === 0) return null;

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from("rfq-attachments").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "URL signée indisponible");
    }
    return data.signedUrl;
  };

  const download = async (path: string, name: string) => {
    try {
      const url = await getSignedUrl(path);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
    } catch (e: any) {
      console.error("download error", e);
    }
  };

  const openPreview = async (a: { storage_path: string; file_name: string; mime_type: string }) => {
    const isImg = a.mime_type?.startsWith("image/");
    const isPdf = a.mime_type === "application/pdf";
    if (!isImg && !isPdf) return;
    try {
      const url = await getSignedUrl(a.storage_path);
      setPreview({ url, name: a.file_name, kind: isImg ? "image" : "pdf" });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <VCard>
        <p className="text-[12px] font-semibold text-[#1D2530] mb-2">
          Pièces jointes de l'acheteur ({data!.length})
        </p>
        <ul className="space-y-1">
          {data!.map((a) => {
            const previewable = a.mime_type?.startsWith("image/") || a.mime_type === "application/pdf";
            return (
              <li key={a.id} className="flex items-center gap-2 text-[12px] bg-[#F8FAFC] px-2 py-1.5 rounded">
                <span className="text-[#475569] shrink-0"><AttachmentIcon mime={a.mime_type} /></span>
                <span className="truncate flex-1">
                  {a.file_name}{" "}
                  <span className="text-[#8B95A5]">({formatBytes(a.size_bytes)})</span>
                </span>
                {previewable && (
                  <button
                    onClick={() => openPreview(a)}
                    className="text-[#1C58D9] hover:underline inline-flex items-center gap-1"
                    title="Aperçu"
                  >
                    <Eye size={12} /> Aperçu
                  </button>
                )}
                <button
                  onClick={() => download(a.storage_path, a.file_name)}
                  className="text-[#1C58D9] hover:underline inline-flex items-center gap-1"
                >
                  <FileDown size={12} /> Télécharger
                </button>
              </li>
            );
          })}
        </ul>
      </VCard>

      {preview && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <p className="text-sm font-semibold truncate">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            {preview.kind === "image" ? (
              <img src={preview.url} alt={preview.name} className="object-contain max-h-[80vh] mx-auto" />
            ) : (
              <iframe src={preview.url} title={preview.name} className="w-full h-[80vh]" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
