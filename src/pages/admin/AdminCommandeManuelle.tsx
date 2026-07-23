import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, FileText, FolderOpen, CalendarClock, Copy, Pencil, ExternalLink } from "lucide-react";

import AdminTopBar from "@/components/admin/AdminTopBar";
import { fmtEur } from "@/lib/format-currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
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
  gtin?: string;
  cnk_code?: string;
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
  const [customerNotes, setCustomerNotes] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([]);
  const [draftId, _setDraftId] = useState<string | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const setDraftId = (id: string | null) => { draftIdRef.current = id; _setDraftId(id); };
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  // Date d'encodage (datetime-local). Vide = now() côté serveur. Si dans le futur → tag prévisionnel auto.
  const [encodingAt, setEncodingAt] = useState<string>("");
  const [isForecast, setIsForecast] = useState<boolean>(false);
  const [duplicatedFrom, setDuplicatedFrom] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [shippingAddressId, setShippingAddressId] = useState<string>("");
  const [fulfillmentMode, setFulfillmentMode] = useState<"pickup" | "delivery">("delivery");


  const [submitting, setSubmitting] = useState(false);
  const [docMode, setDocMode] = useState<"order" | "quote">("order");
  const [quoteValidityDays, setQuoteValidityDays] = useState<number>(7);
  const [quoteNotesCustomer, setQuoteNotesCustomer] = useState<string>("");


  // Quick-create customer modal
  const [qcOpen, setQcOpen] = useState(false);
  const [qcName, setQcName] = useState("");
  const [qcEmail, setQcEmail] = useState("");
  const [qcCountry, setQcCountry] = useState("BE");
  const [qcAddressLine1, setQcAddressLine1] = useState("");
  const [qcCity, setQcCity] = useState("");
  const [qcPostalCode, setQcPostalCode] = useState("");
  const [qcVatNumber, setQcVatNumber] = useState("");
  const [qcCustomerType, setQcCustomerType] = useState<string>("other");
  const [qcSubmitting, setQcSubmitting] = useState(false);

  async function quickCreateCustomer() {
    const name = qcName.trim();
    const email = qcEmail.trim().toLowerCase();
    const country = qcCountry.trim().toUpperCase() || "BE";
    const addressLine1 = qcAddressLine1.trim();
    const city = qcCity.trim();
    const postalCode = qcPostalCode.trim();
    const vatNumber = qcVatNumber.trim().toUpperCase().replace(/\s+/g, "");
    if (!name) return toast.error("Nom requis");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Email invalide");
    if (!/^[A-Z]{2}$/.test(country)) return toast.error("Code pays ISO 2 lettres (ex. BE, FR, LU)");
    if (!addressLine1) return toast.error("Adresse ligne 1 requise");
    if (!city) return toast.error("Ville requise");
    if (!postalCode) return toast.error("Code postal requis");
    if (vatNumber && !/^[A-Z]{2}[A-Z0-9]{2,15}$/.test(vatNumber)) {
      return toast.error("N° TVA invalide (ex. BE0123456789)");
    }
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
          vat_number: vatNumber || null,
          customer_type: qcCustomerType as any,
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
      setQcAddressLine1(""); setQcCity(""); setQcPostalCode(""); setQcVatNumber("");
      setQcCustomerType("other");
    } catch (e: any) {
      toast.error("Échec création : " + (e?.message ?? String(e)));
    } finally {
      setQcSubmitting(false);
    }
  }

  // Customers (search by company_name / email / vat_number / city)
  const { data: customersRaw = [] } = useQuery({
    queryKey: ["admin-manual-order-customers", customerSearch],
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select("id, company_name, email, country_code")
        .order("company_name", { ascending: true })
        .limit(50);
      const s = customerSearch.trim();
      if (s) {
        const p = `%${s}%`;
        q = q.or(`company_name.ilike.${p},email.ilike.${p},vat_number.ilike.${p},city.ilike.${p}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // S'assure que le client sélectionné (édition d'un brouillon) est toujours dans la liste
  const { data: selectedCustomer } = useQuery({
    queryKey: ["admin-manual-order-customer-selected", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, company_name, email, country_code")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const customers = useMemo(() => {
    if (!selectedCustomer) return customersRaw;
    if (customersRaw.some((c: any) => c.id === selectedCustomer.id)) return customersRaw;
    return [selectedCustomer, ...customersRaw];
  }, [customersRaw, selectedCustomer]);

  // Adresses de livraison du customer sélectionné
  const { data: shippingAddresses = [], refetch: refetchShippingAddresses, isFetching: isFetchingShippingAddresses } = useQuery({
    queryKey: ["admin-manual-order-shipping-addresses", customerId],
    enabled: !!customerId,
    // Ces adresses sont souvent créées/mises à jour depuis une autre fenêtre
    // (fiche customer). On force un refetch systématique pour éviter d'afficher
    // "Aucun site enregistré" alors qu'une adresse vient d'être ajoutée.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_shipping_addresses")
        .select("id, label, address_l1, address_l2, postal_code, city, country_code, is_default")
        .eq("customer_id", customerId)
        .order("is_default", { ascending: false })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; label: string; address_l1: string; address_l2: string | null; postal_code: string | null; city: string | null; country_code: string; is_default: boolean }>;
    },
  });

  // Auto-sélectionne l'adresse par défaut quand on change de customer (sauf si déjà fixée en mode édition)
  useEffect(() => {
    if (!customerId) { setShippingAddressId(""); return; }
    if (shippingAddressId && shippingAddresses.some((a) => a.id === shippingAddressId)) return;
    const def = shippingAddresses.find((a) => a.is_default);
    setShippingAddressId(def?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, shippingAddresses.length]);



  // Vendors (active) — inclut la config commission par défaut pour
  // auto-appliquer le taux contractuel (ex: 50% de la marge) sur chaque
  // ligne d'une commande / prévisionnelle.
  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-manual-order-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, commission_model, commission_rate, margin_split_pct, fixed_commission_amount")
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Calcule le patch commission par défaut pour un vendeur donné.
  // - margin_split  → rate = (100 - margin_split_pct) % sur la marge brute
  // - flat_percentage → rate = commission_rate % sur le CA HTVA
  // - fixed_amount    → amount = fixed_commission_amount €/unité
  function vendorCommissionDefaults(vendorId: string): Partial<ManualLine> | null {
    const v: any = vendors.find((x: any) => x.id === vendorId);
    if (!v) return null;
    const model = v.commission_model ?? "flat_percentage";
    if (model === "margin_split") {
      const pct = Number(v.margin_split_pct);
      if (!Number.isFinite(pct)) return null;
      const mkCut = Math.max(0, 100 - pct);
      return { commission_rate: String(mkCut), commission_amount: "", commission_basis: "margin" };
    }
    if (model === "fixed_amount") {
      const amt = Number(v.fixed_commission_amount);
      if (!Number.isFinite(amt)) return null;
      return { commission_rate: "", commission_amount: String(amt), commission_basis: "ca" };
    }
    // flat_percentage
    const rate = Number(v.commission_rate);
    if (!Number.isFinite(rate)) return null;
    return { commission_rate: String(rate), commission_amount: "", commission_basis: "ca" };
  }

  // Auto-applique les défauts vendeur sur toute ligne sans commission encodée.
  // Garantit qu'une prévisionnelle reste alignée sur le contrat (ex: 50% marge)
  // après chaque édition (changement vendeur, ajout de ligne, import…).
  useEffect(() => {
    if (!vendors.length || !lines.length) return;
    let dirty = false;
    const next = lines.map((l) => {
      if (!l.vendor_id) return l;
      const hasRate = String(l.commission_rate ?? "").trim() !== "";
      const hasAmt = String(l.commission_amount ?? "").trim() !== "";
      if (hasRate || hasAmt) return l;
      const def = vendorCommissionDefaults(l.vendor_id);
      if (!def) return l;
      dirty = true;
      return { ...l, ...def };
    });
    if (dirty) setLines(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, vendors]);

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
    setLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const merged: ManualLine = { ...l, ...patch };
      // Si on change de vendeur, on ré-applique le taux contractuel par défaut
      // pour ne pas conserver le taux de l'ancien vendeur.
      if (patch.vendor_id && patch.vendor_id !== l.vendor_id) {
        const def = vendorCommissionDefaults(patch.vendor_id);
        if (def) Object.assign(merged, def);
      }
      return merged;
    }));
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
    const selectedShippingAddress = shippingAddressId ? shippingAddresses.find((a) => a.id === shippingAddressId) : null;
    const shippingSnapshot = fulfillmentMode === "delivery" && selectedShippingAddress ? {
      label: selectedShippingAddress.label,
      address_l1: selectedShippingAddress.address_l1,
      address_l2: selectedShippingAddress.address_l2,
      postal_code: selectedShippingAddress.postal_code,
      city: selectedShippingAddress.city,
      country_code: selectedShippingAddress.country_code,
    } : null;

    const payload = {
      customer_id: customerId,
      status,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      admin_notes: adminNotes || null,
      created_at: encodingIso,
      is_forecast: isForecast || futureEncoding,
      fulfillment_mode: fulfillmentMode,
      shipping_address_id: fulfillmentMode === "delivery" ? (shippingAddressId || null) : null,
      shipping_address: shippingSnapshot,
      lines: lines.map((l) => ({
        vendor_id: l.vendor_id,
        offer_id: l.offer_id ?? null,
        product_id: l.product_id ?? null,
        manual_label: l.manual_label ?? l.offer_label ?? null,
        quantity: l.quantity,
        unit_price_excl_vat: l.unit_price_excl_vat,
        vat_rate: l.vat_rate,
        unit_cost_excl_vat: l.unit_cost_excl_vat || "",
        commission_rate: l.commission_rate || "",
        commission_amount: l.commission_amount || "",
        commission_basis: l.commission_basis ?? "ca",
        gtin: l.gtin ?? null,
        cnk_code: l.cnk_code ?? null,
      })),
    };


    setSubmitting(true);
    try {
      if (docMode === "quote") {
        // Branche Devis : header single-vendor (= vendor de la 1re ligne)
        const vendorIds = Array.from(new Set(lines.map(l => l.vendor_id).filter(Boolean)));
        if (vendorIds.length !== 1) {
          toast.error("Un devis doit cibler un seul vendeur. Toutes les lignes doivent partager le même vendeur.");
          setSubmitting(false);
          return;
        }
        const quotePayload = {
          vendor_id: vendorIds[0],
          customer_id: customerId,
          payment_method: paymentMethod,
          currency_code: "EUR",
          validity_days: quoteValidityDays,
          notes_internal: adminNotes || null,
          notes_customer: quoteNotesCustomer || null,
          lines: lines.map((l) => ({
            product_id: l.mode === "offer" ? l.product_id : null,
            offer_id: l.mode === "offer" ? l.offer_id : null,
            label: l.mode === "free" ? (l.manual_label || "Article") : (l.manual_label?.trim() || l.offer_label || "Article"),
            qty: Number(l.quantity) || 1,
            unit_price_ht_cents: Math.round((Number(l.unit_price_excl_vat) || 0) * 100),
            vat_rate: Number(l.vat_rate) || 21,
            unit_cost_ht_cents: l.unit_cost_excl_vat ? Math.round(Number(l.unit_cost_excl_vat) * 100) : null,
          })),
        };
        const { data, error } = await supabase.rpc("admin_create_quote_from_payload" as any, {
          _payload: quotePayload as any,
        });
        if (error) throw error;
        const result = data as any;
        if (draftId) await supabase.rpc("admin_delete_manual_order_draft", { _id: draftId });
        toast.success("Devis créé");
        await queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
        navigate(`/admin/devis/${result?.quote_id}`);
        return;
      }

      const { data, error } = editingOrderId
        ? await supabase.rpc("admin_update_manual_order" as any, { _order_id: editingOrderId, _payload: payload as any })
        : await supabase.rpc("admin_create_manual_order", { _payload: payload as any });
      if (error) throw error;
      const result = data as any;
      const orderIdForNotes: string | null = editingOrderId ?? (result?.order_id ?? result?.id ?? null);
      if (orderIdForNotes) {
        // Best-effort : persiste le texte libre destiné au client (imprimé sur le PDF).
        await supabase.rpc("admin_set_order_customer_notes" as any, {
          _order_id: orderIdForNotes,
          _notes: customerNotes || "",
        });
      }
      if (draftId) {
        await supabase.rpc("admin_delete_manual_order_draft", { _id: draftId });
      }
      toast.success(editingOrderId ? "Commande mise à jour" : `Commande ${result?.order_number ?? ""} créée`);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders-paginated"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["vendor-dashboard-kpis"] }),
      ]);
      navigate(editingOrderId ? `/admin/commandes/${editingOrderId}` : "/admin/commandes");
    } catch (e: any) {
      toast.error("Échec : " + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Brouillons ----
  function buildDraftPayload() {
    const encodingIso = encodingAt ? new Date(encodingAt).toISOString() : null;
    const futureEncoding = encodingIso ? new Date(encodingIso).getTime() > Date.now() : false;
    const selectedShippingAddress = shippingAddressId ? shippingAddresses.find((a) => a.id === shippingAddressId) : null;
    const shippingSnapshot = fulfillmentMode === "delivery" && selectedShippingAddress ? {
      label: selectedShippingAddress.label,
      address_l1: selectedShippingAddress.address_l1,
      address_l2: selectedShippingAddress.address_l2,
      postal_code: selectedShippingAddress.postal_code,
      city: selectedShippingAddress.city,
      country_code: selectedShippingAddress.country_code,
    } : null;

    return {
      customer_id: customerId || null,
      status,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      admin_notes: adminNotes || null,
      customer_notes: customerNotes || null,
      encoding_at: encodingAt || null,
      created_at: encodingIso,
      is_forecast: isForecast || futureEncoding,
      fulfillment_mode: fulfillmentMode,
      shipping_address_id: fulfillmentMode === "delivery" ? (shippingAddressId || null) : null,
      shipping_address: shippingSnapshot,
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
        gtin: l.gtin ?? null,
        cnk_code: l.cnk_code ?? null,
      })),
    };
  }

  async function saveDraft() {
    if (savingDraft) return; // garde anti double-clic
    const currentDraftId = draftIdRef.current; // évite la fenêtre de course React state
    if (!customerId && !currentDraftId) {
      toast.error("Choisis un acheteur avant d'enregistrer le brouillon");
      return;
    }
    setSavingDraft(true);
    try {
      const { data, error } = await supabase.rpc("admin_save_manual_order_draft", {
        _draft_id: currentDraftId,
        _payload: buildDraftPayload() as any,
      });
      if (error) throw error;
      const id = data as string;
      setDraftId(id);
      // Met à jour l'URL avec ?draft=<id> de façon robuste (nouvelle URLSearchParams)
      const next = new URLSearchParams(searchParams);
      next.set("draft", id);
      setSearchParams(next, { replace: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-manual-order-drafts"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders-paginated"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
      toast.success(currentDraftId ? "Brouillon mis à jour" : "Brouillon enregistré");
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
      setCustomerNotes(p.customer_notes ?? "");
      setEncodingAt(p.encoding_at ?? "");
      setIsForecast(Boolean(p.is_forecast));
      setFulfillmentMode(p.fulfillment_mode === "pickup" ? "pickup" : "delivery");
      setShippingAddressId(p.shipping_address_id ?? "");
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
        gtin: l.gtin ?? undefined,
        cnk_code: l.cnk_code ?? undefined,
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
        setCustomerNotes(p.customer_notes ?? "");
        setEncodingAt("");
        setIsForecast(false);
        setFulfillmentMode(p.fulfillment_mode === "pickup" ? "pickup" : "delivery");
        setShippingAddressId(p.shipping_address_id ?? "");
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
          gtin: l.gtin ?? undefined,
          cnk_code: l.cnk_code ?? undefined,
        })) : []);
        toast.success(`Commande ${p.source_order_number ?? ""} dupliquée — éditez puis créez`);
      } catch (e: any) {
        toast.error("Échec duplication : " + (e?.message ?? String(e)));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateFromUrl]);

  // Édition en place d'une commande existante via ?edit=<orderId>
  const editFromUrl = searchParams.get("edit");
  useEffect(() => {
    if (!editFromUrl || editingOrderId === editFromUrl) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("admin_load_order_for_edit" as any, { _order_id: editFromUrl });
        if (error) throw error;
        const p = data as any;
        if (!p) throw new Error("commande introuvable");
        setEditingOrderId(editFromUrl);
        setCustomerId(p.customer_id ?? "");
        setStatus(p.status ?? "confirmed");
        setPaymentMethod(p.payment_method ?? "invoice");
        setPaymentStatus(p.payment_status ?? "paid");
        setAdminNotes(p.admin_notes ?? "");
        try {
          const { data: cn } = await supabase.rpc("admin_get_order_customer_notes" as any, { _order_id: editFromUrl });
          setCustomerNotes((cn as any) ?? "");
        } catch { setCustomerNotes(""); }
        setEncodingAt(p.encoding_at ?? "");
        setIsForecast(Boolean(p.is_forecast));
        // Charge l'adresse de livraison rattachée (si présente)
        try {
          const { data: ord } = await (supabase as any)
            .from("orders")
            .select("shipping_address_id, fulfillment_mode")
            .eq("id", editFromUrl)
            .maybeSingle();
          if (ord?.shipping_address_id) setShippingAddressId(ord.shipping_address_id);
          if (ord?.fulfillment_mode === "pickup" || ord?.fulfillment_mode === "delivery") {
            setFulfillmentMode(ord.fulfillment_mode);
          }
        } catch { /* noop */ }

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
          gtin: l.gtin ?? undefined,
          cnk_code: l.cnk_code ?? undefined,
        })) : []);
        toast.success("Commande chargée en édition");
      } catch (e: any) {
        toast.error("Échec chargement : " + (e?.message ?? String(e)));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editFromUrl]);





  return (
    <div>
      <AdminTopBar
        title={editingOrderId ? "Édition de commande" : docMode === "quote" ? "Nouveau devis" : "Nouvelle commande manuelle"}
        subtitle={editingOrderId ? "Modification en place — les lignes et totaux seront recalculés" : docMode === "quote" ? "Saisie admin — génère un devis avec lien public 7 j" : "Saisie admin — alimente la GMV"}
      />

      <div className="mb-3 inline-flex rounded-lg border bg-white p-1" style={{ borderColor: "#E2E8F0" }}>
        <button
          type="button"
          onClick={() => setDocMode("order")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition ${docMode === "order" ? "text-white" : "text-slate-600 hover:text-slate-900"}`}
          style={docMode === "order" ? { backgroundColor: "#1C58D9" } : {}}
        >
          Bon de commande
        </button>
        <button
          type="button"
          onClick={() => setDocMode("quote")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition ${docMode === "quote" ? "text-white" : "text-slate-600 hover:text-slate-900"}`}
          style={docMode === "quote" ? { backgroundColor: "#1C58D9" } : {}}
        >
          Devis
        </button>
      </div>

      {docMode === "quote" && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-blue-50/40 border border-blue-100 rounded-lg p-3">
          <div>
            <Label className="text-xs">Validité (jours)</Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={quoteValidityDays}
              onChange={(e) => setQuoteValidityDays(Math.max(1, Math.min(90, Number(e.target.value) || 7)))}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Message à l'acheteur (visible sur le devis)</Label>
            <Textarea
              value={quoteNotesCustomer}
              onChange={(e) => setQuoteNotesCustomer(e.target.value)}
              placeholder="ex : Merci pour votre demande, voici notre proposition…"
              rows={2}
              className="mt-1"
            />
          </div>
        </div>
      )}


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
              <div className="flex items-center gap-2">
                {customerId && (
                  <a
                    href={`/admin/customers?id=${customerId}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Éditer la fiche customer (nouvel onglet)"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-md hover:bg-slate-50"
                    style={{ borderColor: "#E2E8F0" }}
                  >
                    <Pencil size={12} /> Éditer la fiche <ExternalLink size={10} />
                  </a>
                )}

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
                    <div>
                      <Label className="text-xs">Typologie de client</Label>
                      <Select value={qcCustomerType} onValueChange={setQcCustomerType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pharmacy">Pharmacie</SelectItem>
                          <SelectItem value="hospital">Hôpital</SelectItem>
                          <SelectItem value="clinic">Clinique</SelectItem>
                          <SelectItem value="doctor">Médecin</SelectItem>
                          <SelectItem value="dentist">Dentiste</SelectItem>
                          <SelectItem value="veterinary">Vétérinaire</SelectItem>
                          <SelectItem value="nursing_home">MR / MRS</SelectItem>
                          <SelectItem value="wholesaler">Grossiste</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="lab">Laboratoire</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">N° TVA (optionnel)</Label>
                      <Input
                        value={qcVatNumber}
                        onChange={(e) => setQcVatNumber(e.target.value)}
                        maxLength={20}
                        placeholder="Ex. BE0123456789"
                      />
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
            </div>
            <CustomerCombobox
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              search={customerSearch}
              onSearchChange={setCustomerSearch}
            />

            {customerId && (
              <div className="pt-2 border-t space-y-3" style={{ borderColor: "#E2E8F0" }}>
                <div>
                  <Label className="text-xs">Mode logistique</Label>
                  <Select value={fulfillmentMode} onValueChange={(v) => setFulfillmentMode(v as "pickup" | "delivery")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivery">📦 Livraison</SelectItem>
                      <SelectItem value="pickup">🏬 Picking (retrait sur place)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fulfillmentMode === "delivery" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Adresse de livraison</Label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { void refetchShippingAddresses(); }}
                          className="text-[11px] underline text-slate-500 hover:text-slate-700 disabled:opacity-50"
                          title="Recharger la liste des adresses"
                          disabled={isFetchingShippingAddresses}
                        >
                          {isFetchingShippingAddresses ? "Rafraîchissement…" : "Rafraîchir"}
                        </button>
                        <a
                          href={`/admin/customers?id=${customerId}#shipping`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] underline text-slate-500 hover:text-slate-700"
                          title="Gérer les adresses de livraison du customer"
                        >
                          Gérer les sites
                        </a>
                      </div>
                    </div>
                    {shippingAddresses.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Aucun site de livraison enregistré. <a className="underline" href={`/admin/customers?id=${customerId}#shipping`} target="_blank" rel="noreferrer">En ajouter</a>.
                      </p>
                    ) : (
                      <Select value={shippingAddressId || "__none__"} onValueChange={(v) => setShippingAddressId(v === "__none__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Choisir une adresse" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Aucune (livraison non précisée) —</SelectItem>
                          {shippingAddresses.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label}{a.is_default ? " ⭐" : ""} · {a.postal_code ?? ""} {a.city ?? ""} ({a.country_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {shippingAddressId && (() => {
                      const a = shippingAddresses.find((x) => x.id === shippingAddressId);
                      if (!a) return null;
                      return (
                        <div className="mt-2 p-2 rounded bg-slate-50 text-[11px] text-slate-700 leading-snug">
                          <div className="font-medium text-slate-900">{a.label}</div>
                          <div>{a.address_l1}</div>
                          {a.address_l2 && <div>{a.address_l2}</div>}
                          <div>{a.postal_code} {a.city} ({a.country_code})</div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {fulfillmentMode === "pickup" && (
                  <p className="text-[11px] text-slate-500 italic">
                    Pas d'adresse — l'acheteur retire la marchandise sur place.
                  </p>
                )}
              </div>
            )}
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
            <div className="pt-2 border-t" style={{ borderColor: "#E2E8F0" }}>
              <Label className="text-xs flex items-center gap-1">
                <CalendarClock size={12} /> Date d'encodage
              </Label>
              <Input
                type="datetime-local"
                value={encodingAt}
                onChange={(e) => {
                  const v = e.target.value;
                  setEncodingAt(v);
                  if (v && new Date(v).getTime() > Date.now()) setIsForecast(true);
                }}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Vide = maintenant. Une date future tague automatiquement la commande comme prévisionnelle.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isForecast}
                onChange={(e) => setIsForecast(e.target.checked)}
              />
              <span className="font-medium">Marquer comme commande prévisionnelle</span>
            </label>
          </div>


          <div className="bg-white rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="font-semibold text-sm">Notes admin</h3>
            <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={4} placeholder="Contexte, référence interne…" />
          </div>

          <div className="bg-white rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Notes client (imprimées sur le PDF)</h3>
              <span className="text-xs text-muted-foreground">Visible par le client</span>
            </div>
            <Textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={4}
              placeholder="Mention libre affichée sur le PDF côté client (ex. conditions particulières, remerciements, référence dossier…)"
            />
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Aperçu PDF (temps réel)
              </p>
              <div className="rounded-md border bg-slate-50 p-3">
                <div className="mx-auto max-w-md rounded-sm bg-white shadow-sm border p-4">
                  <div className="text-[10px] text-slate-400 mb-2 border-b pb-1">
                    …en-tête facture / commande…
                  </div>
                  {customerNotes.trim() ? (
                    <div
                      className="rounded border-l-4 p-2.5"
                      style={{ borderLeftColor: "#2563EB", backgroundColor: "#EFF6FF" }}
                    >
                      <div
                        className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                        style={{ color: "#1D4ED8" }}
                      >
                        Notes
                      </div>
                      <div className="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-800">
                        {customerNotes}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] italic text-slate-400 py-3 text-center">
                      Aucune note — rien ne sera affiché sur le PDF.
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-2 border-t pt-1">
                    …tableau des lignes produits…
                  </div>
                </div>
              </div>
            </div>
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
                       <div className="text-right">{fmtEur(b.ca)} €</div>
                       <div className="text-right">{b.hasCost ? `${fmtEur(b.cost)} €` : "—"}</div>
                       <div className="text-right">
                         {fmtEur(b.commission)} €
                         {b.ca > 0 && (
                           <span className="text-muted-foreground ml-1">({((b.commission / b.ca) * 100).toFixed(1)}%)</span>
                         )}
                       </div>
                       <div className="text-right font-semibold">{fmtEur(b.netVendor)} €</div>
                     </div>
                   );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border p-4 space-y-1" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex justify-between text-sm">
              <span>CA HTVA</span>
              <span className="font-semibold">{fmtEur(totals.excl)} €</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>TVA</span>
              <span>{fmtEur(totals.vat)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Coût achat total</span>
              <span>{totals.hasAnyCost ? `${fmtEur(totals.cost)} €` : "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Marge brute</span>
              <span>{totals.hasAnyCost ? `${fmtEur(totals.gross)} €` : "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>
                Commission MediKong
                {totals.excl > 0 && (
                  <span className="text-muted-foreground ml-1">({((totals.commission / totals.excl) * 100).toFixed(1)}% du CA)</span>
                )}
              </span>
              <span className="text-emerald-600 font-semibold">{fmtEur(totals.commission)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Net vendeur (HTVA)</span>
              <span className="font-semibold">{fmtEur(totals.netVendor)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Marge nette vendeur</span>
              <span>{totals.hasAnyCost ? `${fmtEur(totals.netMargin)} €` : "—"}</span>
            </div>
            <div className="flex justify-between text-base mt-2 pt-2 border-t">
              <span className="font-semibold">Total TTC</span>
              <span className="font-bold">{fmtEur(totals.incl)} €</span>
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
            {!editingOrderId && draftId && (
              <Button variant="outline" onClick={discardDraft} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                <Trash2 size={14} className="mr-1" /> Supprimer brouillon
              </Button>
            )}
            {!editingOrderId && (
              <Button variant="outline" onClick={saveDraft} disabled={savingDraft}>
                <FileText size={14} className="mr-1" />
                {savingDraft ? "Enregistrement…" : draftId ? "Mettre à jour brouillon" : "Enregistrer brouillon"}
              </Button>
            )}
            <Button onClick={submit} disabled={submitting}>
              <Save size={14} className="mr-1" />
              {submitting
                ? (editingOrderId ? "Mise à jour…" : "Création…")
                : editingOrderId
                  ? "Mettre à jour la commande"
                  : draftId ? "Finaliser la commande" : "Créer la commande"}
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
  const [offerSearch, setOfferSearch] = useState(line.offer_label ?? "");
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
          <VendorCombobox
            vendors={vendors}
            value={line.vendor_id}
            onChange={(v) => onPatch({ vendor_id: v })}
          />
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
                          gtin: o.products?.gtin ?? undefined,
                          cnk_code: o.products?.cnk_code ?? undefined,
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
                            : `${fmtEur(price)} €`}
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
              <>
                <div className="mt-1 text-xs text-muted-foreground">
                  {line.offer_id ? "Offre liée" : "Produit lié (sans offre)"} : {line.offer_label}
                  {(line.gtin || line.cnk_code) && (
                    <span className="ml-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {line.gtin ? `EAN ${line.gtin}` : ""}
                      {line.gtin && line.cnk_code ? " · " : ""}
                      {line.cnk_code ? `CNK ${line.cnk_code}` : ""}
                    </span>
                  )}
                  {" "}·{" "}
                  <button type="button" className="underline" onClick={() => { onPatch({ offer_id: undefined, product_id: undefined, offer_label: undefined, manual_label: undefined, gtin: undefined, cnk_code: undefined }); setOfferSearch(""); toast.info("Produit lié changé — le libellé override a été réinitialisé."); }}>changer le produit lié</button>
                </div>
                <div className="mt-1 flex items-start gap-1.5 rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900">
                  <span aria-hidden>💡</span>
                  <span>
                    Le <strong>libellé override</strong> ci-dessous remplace uniquement l'<em>affichage</em> (commande, PDF, page publique). La <strong>relation au produit</strong> (offer_id, product_id, EAN, CNK) reste intacte. Pour changer le produit réellement lié, utilise « <strong>changer le produit lié</strong> ».
                  </span>
                </div>

                <div className="mt-2">
                  <Label className="text-xs">Libellé affiché (override)</Label>
                  <Input
                    placeholder={line.offer_label ?? "Libellé override (laisser vide pour utiliser le nom du produit lié)"}
                    value={line.manual_label ?? ""}
                    onChange={(e) => onPatch({ manual_label: e.target.value })}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Modifie le libellé visible (commande, PDF, page publique). Le lien produit, EAN et CNK sont conservés.
                  </p>
                </div>
              </>
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
            disabled={Number(line.commission_amount) > 0 && String(line.commission_rate ?? "").trim() === ""}
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
            disabled={Number(line.commission_rate) > 0 && String(line.commission_amount ?? "").trim() === ""}
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
              <div className="font-semibold">{fmtEur(m.ca)} €</div>
            </div>
            <div>
              <div className="text-muted-foreground">Marge brute</div>
              <div className="font-semibold">{m.hasCost ? `${fmtEur(m.gross)} €` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Commission MK</div>
              <div className="font-semibold text-emerald-600">{fmtEur(m.commission)} €</div>
            </div>
            <div>
              <div className="text-muted-foreground">Net vendeur</div>
              <div className="font-semibold">{fmtEur(m.netVendor)} €</div>
            </div>
            <div>
              <div className="text-muted-foreground">Marge nette</div>
              <div className="font-semibold">{m.hasCost ? `${fmtEur(m.netMargin)} €` : "—"}</div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

function VendorCombobox({
  vendors,
  value,
  onChange,
}: {
  vendors: any[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = vendors.find((v) => v.id === value);
  const label = selected ? (selected.name ?? selected.company_name ?? selected.id.slice(0, 8)) : "Choisir un vendeur";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={selected ? "" : "text-muted-foreground"}>{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un vendeur…" />
          <CommandList>
            <CommandEmpty>Aucun vendeur trouvé.</CommandEmpty>
            <CommandGroup>
              {vendors.map((v) => {
                const name = v.name ?? v.company_name ?? v.id.slice(0, 8);
                return (
                  <CommandItem
                    key={v.id}
                    value={name}
                    onSelect={() => {
                      onChange(v.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === v.id ? "opacity-100" : "opacity-0"}`} />
                    {name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CustomerCombobox({
  customers,
  value,
  onChange,
  search,
  onSearchChange,
}: {
  customers: any[];
  value: string;
  onChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value);
  const label = selected
    ? `${selected.company_name || selected.email}${selected.country_code ? ` · ${selected.country_code}` : ""}`
    : "Sélectionner un acheteur";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={selected ? "" : "text-muted-foreground"}>{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher (nom, email, TVA, ville)…"
            value={search}
            onValueChange={onSearchChange}
          />
          <CommandList>
            <CommandEmpty>Aucun acheteur trouvé.</CommandEmpty>
            <CommandGroup>
              {customers.map((c) => {
                const name = `${c.company_name || c.email}${c.country_code ? ` · ${c.country_code}` : ""}`;
                return (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === c.id ? "opacity-100" : "opacity-0"}`} />
                    {name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default AdminCommandeManuelle;

