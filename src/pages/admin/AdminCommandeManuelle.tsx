import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, FileText, FolderOpen, CalendarClock, Copy } from "lucide-react";

import AdminTopBar from "@/components/admin/AdminTopBar";
import { fmtEur } from "@/lib/format-currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  lineMetrics as computeLineMetrics,
  computeOrderTotals,
  checkCoherence,
  type ManualLineInput,
} from "@/lib/manual-order-metrics";

type LineMode = "offer" | "free";

interface ManualLine {
  id: string;
  mode: LineMode;
  vendor_id: string;
  // offer mode
  offer_id?: string;
  product_id?: string;
  offer_label?: string;
  // free mode
  manual_label?: string;
  // common
  quantity: number;
  unit_price_excl_vat: number;
  vat_rate: number; // percent
  // marge / commission (par ligne, optionnel)
  unit_cost_excl_vat: string; // €/unité HTVA
  commission_rate: string; // %
  commission_amount: string; // €/unité
  /** Base du % de commission : "ca" (CA HTVA, défaut) ou "margin" (marge brute = CA − coût) */
  commission_basis: "ca" | "margin";
}

// Wrapper local pour préserver l'API d'origine (ManualLine UI → ManualLineInput).
const lineMetrics = (l: ManualLine) => computeLineMetrics(l as ManualLineInput);


const ORDER_STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "processing", label: "En préparation" },
  { value: "shipped", label: "Expédiée" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];

const PAYMENT_METHODS = [
  { value: "card", label: "Carte bancaire" },
  { value: "bank_transfer", label: "Virement SEPA" },
  { value: "invoice", label: "Facture" },
];

const PAYMENT_STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "paid", label: "Payée" },
  { value: "failed", label: "Échec" },
  { value: "refunded", label: "Remboursée" },
];

function nid() {
  return Math.random().toString(36).slice(2);
}

const AdminCommandeManuelle = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [status, setStatus] = useState("confirmed");
  const [paymentMethod, setPaymentMethod] = useState("invoice");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [adminNotes, setAdminNotes] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  // Date d'encodage (datetime-local). Vide = now() côté serveur. Si dans le futur → tag prévisionnel auto.
  const [encodingAt, setEncodingAt] = useState<string>("");
  const [isForecast, setIsForecast] = useState<boolean>(false);
  const [duplicatedFrom, setDuplicatedFrom] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);


  // Quick-create customer modal
  const [qcOpen, setQcOpen] = useState(false);
  const [qcName, setQcName] = useState("");
  const [qcEmail, setQcEmail] = useState("");
  const [qcCountry, setQcCountry] = useState("BE");
  const [qcAddressLine1, setQcAddressLine1] = useState("");
  const [qcCity, setQcCity] = useState("");
  const [qcPostalCode, setQcPostalCode] = useState("");
  const [qcSubmitting, setQcSubmitting] = useState(false);

  async function quickCreateCustomer() {
    const name = qcName.trim();
    const email = qcEmail.trim().toLowerCase();
    const country = qcCountry.trim().toUpperCase() || "BE";
    const addressLine1 = qcAddressLine1.trim();
    const city = qcCity.trim();
    const postalCode = qcPostalCode.trim();
    if (!name) return toast.error("Nom requis");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Email invalide");
    if (!/^[A-Z]{2}$/.test(country)) return toast.error("Code pays ISO 2 lettres (ex. BE, FR, LU)");
    if (!addressLine1) return toast.error("Adresse ligne 1 requise");
    if (!city) return toast.error("Ville requise");
    if (!postalCode) return toast.error("Code postal requis");
    setQcSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_name: name,
          email,
          country_code: country,
          address_line1: addressLine1,
          city,
          postal_code: postalCode,
        })
        .select("id, company_name, email, country_code")
        .single();
      if (error) throw error;
      toast.success(`Customer « ${data.company_name} » créé`);
      setCustomerId(data.id);
      setCustomerSearch(data.company_name);
      await queryClient.invalidateQueries({ queryKey: ["admin-manual-order-customers"] });
      setQcOpen(false);
      setQcName(""); setQcEmail(""); setQcCountry("BE");
      setQcAddressLine1(""); setQcCity(""); setQcPostalCode("");
    } catch (e: any) {
      toast.error("Échec création : " + (e?.message ?? String(e)));
    } finally {
      setQcSubmitting(false);
    }
  }

  // Customers (search by company_name / email)
  const { data: customers = [] } = useQuery({
    queryKey: ["admin-manual-order-customers", customerSearch],
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select("id, company_name, email, country_code")
        .order("company_name", { ascending: true })
        .limit(20);
      if (customerSearch.trim()) {
        const s = `%${customerSearch.trim()}%`;
        q = q.or(`company_name.ilike.${s},email.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Vendors (active)
  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-manual-order-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name")
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => computeOrderTotals(lines as ManualLineInput[]), [lines]);
  const coherence = useMemo(() => checkCoherence(lines as ManualLineInput[]), [lines]);


  // récap par vendeur (à partir des métriques par ligne)
  const vendorBreakdown = useMemo(() => {
    const map = new Map<string, { ca: number; cost: number; commission: number; netVendor: number; hasCost: boolean }>();
    for (const l of lines) {
      if (!l.vendor_id) continue;
      const m = lineMetrics(l);
      const prev = map.get(l.vendor_id) ?? { ca: 0, cost: 0, commission: 0, netVendor: 0, hasCost: false };
      prev.ca += m.ca;
      if (m.hasCost) { prev.cost += m.cost; prev.hasCost = true; }
      prev.commission += m.commission;
      prev.netVendor += m.ca - m.commission;
      map.set(l.vendor_id, prev);
    }
    return Array.from(map.entries());
  }, [lines]);


  function addLine(mode: LineMode) {
    setLines((prev) => [
      ...prev,
      {
        id: nid(),
        mode,
        vendor_id: "",
        quantity: 1,
        unit_price_excl_vat: 0,
        vat_rate: 21,
        unit_cost_excl_vat: "",
        commission_rate: "",
        commission_amount: "",
        commission_basis: "ca",
      },
    ]);
  }


  function patchLine(id: string, patch: Partial<ManualLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function searchOffers(line: ManualLine, term: string) {
    // Recherche par nom de produit OU par code-barres (EAN/GTIN) / CNK.
    // On retourne aussi les produits sans offre liée, pour permettre à l'admin
    // de créer une ligne sur un produit existant en DB même si aucun vendeur
    // n'a encore d'offre dessus.
    const t = term.trim();
    if (!t || t.length < 2) return [] as any[];
    const digits = /^\d{6,}$/.test(t);

    // 1) Offres actives matchant nom OU gtin/cnk du produit
    const offersQuery = supabase
      .from("offers")
      .select("id, vendor_id, product_id, base_price_excl_vat, products!inner(id, name, gtin, cnk_code)")
      .eq("is_active", true)
      .limit(10);
    const offersResult = digits
      ? await offersQuery.or(`gtin.eq.${t},cnk_code.eq.${t}`, { foreignTable: "products" })
      : await offersQuery.ilike("products.name", `%${t}%`);
    const offers = offersResult.data ?? [];

    // 2) Produits matchant (par EAN/CNK exact si digits, sinon par nom)
    const productsQ = supabase
      .from("products")
      .select("id, name, gtin, cnk_code")
      .eq("is_active", true)
      .limit(10);
    const productsResult = digits
      ? await productsQ.or(`gtin.eq.${t},cnk_code.eq.${t}`)
      : await productsQ.ilike("name", `%${t}%`);
    const products = productsResult.data ?? [];

    // Fusion : on garde toutes les offres, puis on ajoute les produits sans offre
    // sous forme d'entrée "produit seul" (offer_id absent).
    const offerProductIds = new Set(offers.map((o: any) => o.product_id));
    const productOnly = products
      .filter((p: any) => !offerProductIds.has(p.id))
      .map((p: any) => ({
        id: null, // pas d'offre
        vendor_id: null,
        product_id: p.id,
        base_price_excl_vat: null,
        products: p,
        __productOnly: true as const,
      }));
    return [...offers, ...productOnly];
  }


  async function submit() {
    if (!customerId) {
      toast.error("Choisis un acheteur");
      return;
    }
    if (lines.length === 0) {
      toast.error("Ajoute au moins une ligne");
      return;
    }
    for (const l of lines) {
      if (!l.vendor_id) return toast.error("Sélectionne le vendeur pour chaque ligne");
      if (l.mode === "free" && !l.manual_label?.trim())
        return toast.error("Libellé manquant sur une ligne libre");
      if (l.mode === "offer" && !l.offer_id && !l.product_id)
        return toast.error("Sélectionne une offre ou un produit pour chaque ligne 'offre'");

      if (!(l.quantity > 0)) return toast.error("Quantité invalide");
      if (!(l.unit_price_excl_vat >= 0)) return toast.error("Prix HTVA invalide");
    }

    const encodingIso = encodingAt ? new Date(encodingAt).toISOString() : null;
    const futureEncoding = encodingIso ? new Date(encodingIso).getTime() > Date.now() : false;
    const payload = {
      customer_id: customerId,
      status,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      admin_notes: adminNotes || null,
      created_at: encodingIso,
      is_forecast: isForecast || futureEncoding,
      lines: lines.map((l) => ({
        vendor_id: l.vendor_id,
        offer_id: l.mode === "offer" ? l.offer_id : null,
        product_id: l.mode === "offer" ? l.product_id : null,
        manual_label: l.mode === "free" ? l.manual_label : null,
        quantity: l.quantity,
        unit_price_excl_vat: l.unit_price_excl_vat,
        vat_rate: l.vat_rate,
        unit_cost_excl_vat: l.unit_cost_excl_vat || "",
        commission_rate: l.commission_rate || "",
        commission_amount: l.commission_amount || "",
        commission_basis: l.commission_basis ?? "ca",
      })),
    };


    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_manual_order", {
        _payload: payload as any,
      });
      if (error) throw error;
      const result = data as any;
      // Si on finalisait un brouillon, on le supprime
      if (draftId) {
        await supabase.rpc("admin_delete_manual_order_draft", { _id: draftId });
      }
      toast.success(`Commande ${result?.order_number ?? ""} créée`);
      navigate("/admin/commandes");
    } catch (e: any) {
      toast.error("Échec : " + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Brouillons ----
  function buildDraftPayload() {
    return {
      customer_id: customerId || null,
      status,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      admin_notes: adminNotes || null,
      encoding_at: encodingAt || null,
      is_forecast: isForecast,
      lines: lines.map((l) => ({
        id: l.id,
        mode: l.mode,
        vendor_id: l.vendor_id,
        offer_id: l.offer_id ?? null,
        product_id: l.product_id ?? null,
        offer_label: l.offer_label ?? null,
        manual_label: l.manual_label ?? null,
        quantity: l.quantity,
        unit_price_excl_vat: l.unit_price_excl_vat,
        vat_rate: l.vat_rate,
        unit_cost_excl_vat: l.unit_cost_excl_vat,
        commission_rate: l.commission_rate,
        commission_amount: l.commission_amount,
        commission_basis: l.commission_basis,
      })),
    };
  }

  async function saveDraft() {
    if (!customerId && !draftId) {
      toast.error("Choisis un acheteur avant d'enregistrer le brouillon");
      return;
    }
    setSavingDraft(true);
    try {
      const { data, error } = await supabase.rpc("admin_save_manual_order_draft", {
        _draft_id: draftId,
        _payload: buildDraftPayload() as any,
      });
      if (error) throw error;
      const id = data as string;
      setDraftId(id);
      setSearchParams((sp) => { sp.set("draft", id); return sp; }, { replace: true });
      await queryClient.invalidateQueries({ queryKey: ["admin-manual-order-drafts"] });
      toast.success("Brouillon enregistré");
    } catch (e: any) {
      toast.error("Échec enregistrement : " + (e?.message ?? String(e)));
    } finally {
      setSavingDraft(false);
    }
  }

  async function loadDraft(id: string) {
    try {
      const { data, error } = await supabase.rpc("admin_load_manual_order_draft", { _id: id });
      if (error) throw error;
      const p = data as any;
      if (!p) throw new Error("brouillon vide");
      setDraftId(id);
      setCustomerId(p.customer_id ?? "");
      setStatus(p.status ?? "confirmed");
      setPaymentMethod(p.payment_method ?? "invoice");
      setPaymentStatus(p.payment_status ?? "paid");
      setAdminNotes(p.admin_notes ?? "");
      setEncodingAt(p.encoding_at ?? "");
      setIsForecast(Boolean(p.is_forecast));
      setLines(Array.isArray(p.lines) ? p.lines.map((l: any) => ({
        id: l.id ?? nid(),
        mode: l.mode ?? "offer",
        vendor_id: l.vendor_id ?? "",
        offer_id: l.offer_id ?? undefined,
        product_id: l.product_id ?? undefined,
        offer_label: l.offer_label ?? undefined,
        manual_label: l.manual_label ?? undefined,
        quantity: Number(l.quantity) || 1,
        unit_price_excl_vat: Number(l.unit_price_excl_vat) || 0,
        vat_rate: Number(l.vat_rate ?? 21),
        unit_cost_excl_vat: l.unit_cost_excl_vat ?? "",
        commission_rate: l.commission_rate ?? "",
        commission_amount: l.commission_amount ?? "",
        commission_basis: l.commission_basis === "margin" ? "margin" : "ca",
      })) : []);
      setSearchParams((sp) => { sp.set("draft", id); return sp; }, { replace: true });
      setDraftsOpen(false);
      toast.success("Brouillon chargé");
    } catch (e: any) {
      toast.error("Échec chargement : " + (e?.message ?? String(e)));
    }
  }

  async function discardDraft() {
    if (!draftId) return;
    if (!confirm("Supprimer définitivement ce brouillon ?")) return;
    try {
      const { error } = await supabase.rpc("admin_delete_manual_order_draft", { _id: draftId });
      if (error) throw error;
      setDraftId(null);
      setSearchParams((sp) => { sp.delete("draft"); return sp; }, { replace: true });
      await queryClient.invalidateQueries({ queryKey: ["admin-manual-order-drafts"] });
      toast.success("Brouillon supprimé");
    } catch (e: any) {
      toast.error("Échec suppression : " + (e?.message ?? String(e)));
    }
  }

  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ["admin-manual-order-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_manual_order_drafts");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Charge automatiquement le brouillon passé en query string (?draft=<id>)
  const draftFromUrl = searchParams.get("draft");
  useEffect(() => {
    if (draftFromUrl && draftFromUrl !== draftId) {
      void loadDraft(draftFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFromUrl]);

  // Duplication d'une commande existante via ?duplicate=<orderId>
  const duplicateFromUrl = searchParams.get("duplicate");
  useEffect(() => {
    if (!duplicateFromUrl || duplicatedFrom === duplicateFromUrl) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("admin_duplicate_order_payload", { _order_id: duplicateFromUrl });
        if (error) throw error;
        const p = data as any;
        if (!p) throw new Error("commande introuvable");
        setDuplicatedFrom(duplicateFromUrl);
        setCustomerId(p.customer_id ?? "");
        setStatus(p.status ?? "confirmed");
        setPaymentMethod(p.payment_method ?? "invoice");
        setPaymentStatus(p.payment_status ?? "paid");
        setAdminNotes(
          (p.admin_notes ? p.admin_notes + "\n" : "") +
          `[Dupliquée depuis ${p.source_order_number ?? duplicateFromUrl}]`
        );
        setEncodingAt("");
        setIsForecast(false);
        setLines(Array.isArray(p.lines) ? p.lines.map((l: any) => ({
          id: l.id ?? nid(),
          mode: l.mode ?? "offer",
          vendor_id: l.vendor_id ?? "",
          offer_id: l.offer_id ?? undefined,
          product_id: l.product_id ?? undefined,
          offer_label: l.offer_label ?? undefined,
          manual_label: l.manual_label ?? undefined,
          quantity: Number(l.quantity) || 1,
          unit_price_excl_vat: Number(l.unit_price_excl_vat) || 0,
          vat_rate: Number(l.vat_rate ?? 21),
          unit_cost_excl_vat: l.unit_cost_excl_vat ?? "",
          commission_rate: l.commission_rate ?? "",
          commission_amount: l.commission_amount ?? "",
          commission_basis: l.commission_basis === "margin" ? "margin" : "ca",
        })) : []);
        toast.success(`Commande ${p.source_order_number ?? ""} dupliquée — éditez puis créez`);
      } catch (e: any) {
        toast.error("Échec duplication : " + (e?.message ?? String(e)));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateFromUrl]);




  return (
    <div>
      <AdminTopBar
        title="Nouvelle commande manuelle"
        subtitle="Saisie admin — alimente la GMV"
      />

      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <Link to="/admin/commandes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Retour aux commandes
        </Link>
        <div className="flex items-center gap-2">
          {duplicatedFrom && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              <Copy size={12} /> Dupliquée — éditez puis créez
            </span>
          )}
          {(isForecast || (encodingAt && new Date(encodingAt).getTime() > Date.now())) && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              <CalendarClock size={12} /> Prévisionnel
            </span>
          )}
          {draftId && (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Brouillon en cours · {draftId.slice(0, 8)}
            </span>
          )}
          <Dialog open={draftsOpen} onOpenChange={(o) => { setDraftsOpen(o); if (o) void refetchDrafts(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <FolderOpen size={14} className="mr-1" /> Brouillons ({drafts.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Brouillons de commande manuelle</DialogTitle>
              </DialogHeader>
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Aucun brouillon enregistré.</p>
              ) : (
                <div className="max-h-[60vh] overflow-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1">N°</th>
                        <th className="text-left px-2 py-1">Acheteur</th>
                        <th className="text-right px-2 py-1">Lignes</th>
                        <th className="text-left px-2 py-1">Modifié</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map((d: any) => (
                        <tr key={d.id} className="border-t">
                          <td className="px-2 py-1 font-mono">{d.order_number}</td>
                          <td className="px-2 py-1">{d.customer_label}</td>
                          <td className="px-2 py-1 text-right">{d.line_count}</td>
                          <td className="px-2 py-1">{new Date(d.updated_at).toLocaleString("fr-BE")}</td>
                          <td className="px-2 py-1 text-right">
                            <Button size="sm" variant="outline" onClick={() => loadDraft(d.id)}>
                              Ouvrir
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraftsOpen(false)}>Fermer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: meta */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Acheteur</h3>
              <Dialog open={qcOpen} onOpenChange={setQcOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <UserPlus size={14} className="mr-1" /> Créer à la volée
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer un customer rapide</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Nom / Raison sociale</Label>
                      <Input value={qcName} onChange={(e) => setQcName(e.target.value)} maxLength={200} placeholder="Ex. Pharmacie Dupont SRL" />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={qcEmail} onChange={(e) => setQcEmail(e.target.value)} maxLength={255} placeholder="contact@exemple.be" />
                    </div>
                    <div>
                      <Label className="text-xs">Pays (ISO 2)</Label>
                      <Select value={qcCountry} onValueChange={setQcCountry}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BE">BE — Belgique</SelectItem>
                          <SelectItem value="FR">FR — France</SelectItem>
                          <SelectItem value="LU">LU — Luxembourg</SelectItem>
                          <SelectItem value="NL">NL — Pays-Bas</SelectItem>
                          <SelectItem value="DE">DE — Allemagne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Adresse ligne 1</Label>
                      <Input value={qcAddressLine1} onChange={(e) => setQcAddressLine1(e.target.value)} maxLength={255} placeholder="Ex. Rue de la Procession 23" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Ville</Label>
                        <Input value={qcCity} onChange={(e) => setQcCity(e.target.value)} maxLength={100} placeholder="Ex. Ath" />
                      </div>
                      <div>
                        <Label className="text-xs">Code postal</Label>
                        <Input value={qcPostalCode} onChange={(e) => setQcPostalCode(e.target.value)} maxLength={20} placeholder="Ex. 7822" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setQcOpen(false)}>Annuler</Button>
                    <Button onClick={quickCreateCustomer} disabled={qcSubmitting}>
                      {qcSubmitting ? "Création…" : "Créer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Input
              placeholder="Rechercher (nom, email)…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un acheteur" /></SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name || c.email} {c.country_code ? `· ${c.country_code}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="font-semibold text-sm">Statut & paiement</h3>
            <div>
              <Label className="text-xs">Statut commande</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mode de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Statut paiement</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="font-semibold text-sm">Notes admin</h3>
            <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={4} placeholder="Contexte, référence interne…" />
          </div>
        </div>

        {/* Right: lines + commissions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Lignes</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addLine("offer")}>
                  <Plus size={14} className="mr-1" /> Ligne offre existante
                </Button>
                <Button size="sm" variant="outline" onClick={() => addLine("free")}>
                  <Plus size={14} className="mr-1" /> Ligne libre
                </Button>
              </div>
            </div>

            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">Aucune ligne</p>
            )}

            {lines.map((l, idx) => (
              <LineRow
                key={l.id}
                line={l}
                index={idx}
                vendors={vendors as any}
                onPatch={(p) => patchLine(l.id, p)}
                onRemove={() => removeLine(l.id)}
                searchOffers={searchOffers}
              />
            ))}
          </div>

          {vendorBreakdown.length > 0 && (
            <div className="bg-white rounded-lg border p-4 space-y-2" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="font-semibold text-sm">Récap par vendeur</h3>
              <p className="text-xs text-muted-foreground">
                Commission et net vendeur calculés à partir des valeurs saisies par ligne (taux % OU montant fixe par unité).
              </p>
              <div className="text-xs">
                <div className="grid grid-cols-5 gap-2 font-medium text-muted-foreground border-b pb-1">
                  <div>Vendeur</div>
                  <div className="text-right">CA HTVA</div>
                  <div className="text-right">Coût achat</div>
                  <div className="text-right">Commission MK</div>
                  <div className="text-right">Net vendeur</div>
                </div>
                {vendorBreakdown.map(([vid, b]) => {
                  const v = (vendors as any[]).find((x) => x.id === vid);
                  return (
                    <div key={vid} className="grid grid-cols-5 gap-2 py-1 border-b last:border-0">
                      <div className="truncate">{v?.name ?? v?.company_name ?? vid.slice(0, 8)}</div>
                      <div className="text-right">{fmtEur(b.ca)}&nbsp;€</div>
                      <div className="text-right">{b.hasCost ? `${fmtEur(b.cost)}&nbsp;€` : "—"}</div>
                      <div className="text-right">{fmtEur(b.commission)}&nbsp;€</div>
                      <div className="text-right font-semibold">{fmtEur(b.netVendor)}&nbsp;€</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border p-4 space-y-1" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex justify-between text-sm">
              <span>CA HTVA</span>
              <span className="font-semibold">{fmtEur(totals.excl)}&nbsp;€</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>TVA</span>
              <span>{fmtEur(totals.vat)}&nbsp;€</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Coût achat total</span>
              <span>{totals.hasAnyCost ? `${fmtEur(totals.cost)}&nbsp;€` : "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Marge brute</span>
              <span>{totals.hasAnyCost ? `${fmtEur(totals.gross)}&nbsp;€` : "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Commission MediKong</span>
              <span className="text-emerald-600 font-semibold">{fmtEur(totals.commission)}&nbsp;€</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Net vendeur (HTVA)</span>
              <span className="font-semibold">{fmtEur(totals.netVendor)}&nbsp;€</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Marge nette vendeur</span>
              <span>{totals.hasAnyCost ? `${fmtEur(totals.netMargin)}&nbsp;€` : "—"}</span>
            </div>
            <div className="flex justify-between text-base mt-2 pt-2 border-t">
              <span className="font-semibold">Total TTC</span>
              <span className="font-bold">{fmtEur(totals.incl)}&nbsp;€</span>
            </div>
            <div

              role="status"
              aria-live="polite"
              className={`mt-3 flex items-start gap-2 text-xs rounded-md px-2 py-1.5 border ${
                coherence.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              {coherence.ok ? (
                <>
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Contrôle de cohérence OK — CA HTVA = commission + net vendeur
                    {totals.hasAnyCost ? ", marge brute = marge nette + commission" : ""},
                    TTC = HTVA + TVA. Arrondis 2 décimales au centime.
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold mb-0.5">Incohérence détectée :</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {coherence.issues.map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>



          <div className="flex justify-end gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/admin/commandes")}>Annuler</Button>
            {draftId && (
              <Button variant="outline" onClick={discardDraft} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                <Trash2 size={14} className="mr-1" /> Supprimer brouillon
              </Button>
            )}
            <Button variant="outline" onClick={saveDraft} disabled={savingDraft}>
              <FileText size={14} className="mr-1" />
              {savingDraft ? "Enregistrement…" : draftId ? "Mettre à jour brouillon" : "Enregistrer brouillon"}
            </Button>
            <Button onClick={submit} disabled={submitting}>
              <Save size={14} className="mr-1" />
              {submitting ? "Création…" : draftId ? "Finaliser la commande" : "Créer la commande"}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

function LineRow({
  line, index, vendors, onPatch, onRemove, searchOffers,
}: {
  line: ManualLine;
  index: number;
  vendors: { id: string; name: string | null; company_name: string | null }[];
  onPatch: (p: Partial<ManualLine>) => void;
  onRemove: () => void;
  searchOffers: (line: ManualLine, term: string) => Promise<any[]>;
}) {
  const [offerSearch, setOfferSearch] = useState("");
  const [offerResults, setOfferResults] = useState<any[]>([]);

  return (
    <div className="border rounded-md p-3 space-y-2" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          Ligne #{index + 1} · {line.mode === "offer" ? "Offre existante" : "Saisie libre"}
        </div>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Vendeur</Label>
          <Select value={line.vendor_id} onValueChange={(v) => onPatch({ vendor_id: v })}>
            <SelectTrigger><SelectValue placeholder="Choisir un vendeur" /></SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name ?? v.company_name ?? v.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {line.mode === "offer" ? (
          <div>
            <Label className="text-xs">Offre / produit (nom ou EAN/CNK)</Label>
            <Input
              placeholder="Nom, code-barres EAN ou CNK…"
              value={offerSearch}
              onChange={async (e) => {
                const v = e.target.value;
                setOfferSearch(v);
                const r = await searchOffers(line, v);
                setOfferResults(r);
              }}
            />
            {offerResults.length > 0 && !line.offer_id && !line.product_id && (
              <div className="mt-1 max-h-56 overflow-auto border rounded">
                {offerResults.map((o, idx) => {
                  const productOnly = o.__productOnly === true;
                  const price = Number(o.base_price_excl_vat ?? 0);
                  const code = o.products?.gtin || o.products?.cnk_code || "";
                  return (
                    <button
                      key={o.id ?? `p-${o.product_id ?? idx}`}
                      type="button"
                      className="block w-full text-left text-xs px-2 py-1 hover:bg-muted border-b last:border-0"
                      onClick={() => {
                        onPatch({
                          offer_id: o.id ?? undefined,
                          product_id: o.product_id,
                          vendor_id: line.vendor_id || o.vendor_id || "",
                          unit_price_excl_vat: productOnly ? line.unit_price_excl_vat : price,
                          offer_label: o.products?.name,
                        });
                        setOfferResults([]);
                        setOfferSearch(o.products?.name ?? "");
                      }}
                    >
                      <div className="font-medium">{o.products?.name ?? "—"}</div>
                      <div className="text-muted-foreground flex justify-between gap-2">
                        <span>{code ? `EAN/CNK ${code}` : "—"}</span>
                        <span>
                          {productOnly
                            ? "Produit DB (aucune offre) — cliquer pour lier"
                            : `${fmtEur(price)}&nbsp;€`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {offerSearch.trim().length >= 2 && offerResults.length === 0 && !line.product_id && (
              <div className="mt-1 text-xs text-muted-foreground">
                Aucun résultat. Vérifie l'orthographe ou l'EAN/CNK, ou utilise « Ligne libre ».
              </div>
            )}
            {(line.offer_id || line.product_id) && (
              <div className="mt-1 text-xs text-muted-foreground">
                {line.offer_id ? "Offre liée" : "Produit lié (sans offre)"} : {line.offer_label} ·{" "}
                <button type="button" className="underline" onClick={() => { onPatch({ offer_id: undefined, product_id: undefined, offer_label: undefined }); setOfferSearch(""); }}>changer</button>
              </div>
            )}
          </div>

        ) : (
          <div>
            <Label className="text-xs">Libellé</Label>
            <Input
              placeholder="Désignation libre"
              value={line.manual_label ?? ""}
              onChange={(e) => onPatch({ manual_label: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">Quantité</Label>
          <Input type="number" min="1" value={line.quantity}
            onChange={(e) => onPatch({ quantity: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">PU HTVA €</Label>
          <Input type="number" step="0.0001" min="0" value={line.unit_price_excl_vat}
            onChange={(e) => onPatch({ unit_price_excl_vat: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">TVA %</Label>
          <Input type="number" step="0.01" min="0" max="100" value={line.vat_rate}
            onChange={(e) => onPatch({ vat_rate: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Total TTC</Label>
          <Input
            disabled
            value={(line.unit_price_excl_vat * line.quantity * (1 + line.vat_rate / 100)).toFixed(2)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t" style={{ borderColor: "#E2E8F0" }}>
        <div>
          <Label className="text-xs">Prix d'achat HTVA €/u.</Label>
          <Input
            type="number" step="0.0001" min="0"
            placeholder="optionnel"
            value={line.unit_cost_excl_vat}
            onChange={(e) => onPatch({ unit_cost_excl_vat: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Commission %</Label>
          <Input
            type="number" step="0.01" min="0" max="100"
            placeholder="ex. 12"
            value={line.commission_rate}
            disabled={line.commission_amount !== ""}
            onChange={(e) => onPatch({ commission_rate: e.target.value })}
          />
          <div className="flex items-center gap-1 mt-1 text-[11px]">
            <span className="text-muted-foreground">Base :</span>
            <button
              type="button"
              onClick={() => onPatch({ commission_basis: "ca" })}
              className={`px-2 py-0.5 rounded border ${line.commission_basis !== "margin" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
              title="Commission % appliquée sur le CA HTVA"
            >
              CA HTVA
            </button>
            <button
              type="button"
              onClick={() => onPatch({ commission_basis: "margin" })}
              className={`px-2 py-0.5 rounded border ${line.commission_basis === "margin" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
              title="Commission % appliquée sur la marge brute (CA − coût d'achat). Fallback CA si coût inconnu."
            >
              Marge brute
            </button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Commission €/u. (fixe)</Label>
          <Input
            type="number" step="0.01" min="0"
            placeholder="ex. 1.50"
            value={line.commission_amount}
            disabled={line.commission_rate !== ""}
            onChange={(e) => onPatch({ commission_amount: e.target.value })}
          />
        </div>
      </div>

      {(() => {
        const m = lineMetrics(line);
        return (
          <div className="grid grid-cols-5 gap-2 text-xs bg-muted/40 rounded p-2">
            <div>
              <div className="text-muted-foreground">CA HTVA</div>
              <div className="font-semibold">{fmtEur(m.ca)}&nbsp;€</div>
            </div>
            <div>
              <div className="text-muted-foreground">Marge brute</div>
              <div className="font-semibold">{m.hasCost ? `${fmtEur(m.gross)}&nbsp;€` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Commission MK</div>
              <div className="font-semibold text-emerald-600">{fmtEur(m.commission)}&nbsp;€</div>
            </div>
            <div>
              <div className="text-muted-foreground">Net vendeur</div>
              <div className="font-semibold">{fmtEur(m.netVendor)}&nbsp;€</div>
            </div>
            <div>
              <div className="text-muted-foreground">Marge nette</div>
              <div className="font-semibold">{m.hasCost ? `${fmtEur(m.netMargin)}&nbsp;€` : "—"}</div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

export default AdminCommandeManuelle;
