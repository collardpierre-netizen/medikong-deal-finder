import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import AdminTopBar from "@/components/admin/AdminTopBar";
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
import { UserPlus } from "lucide-react";

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
}

interface CommissionInput {
  rate: string; // %
  amount: string; // EUR
}

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
  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [status, setStatus] = useState("confirmed");
  const [paymentMethod, setPaymentMethod] = useState("invoice");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [adminNotes, setAdminNotes] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([]);
  const [commissions, setCommissions] = useState<Record<string, CommissionInput>>({});
  const [submitting, setSubmitting] = useState(false);

  // Quick-create customer modal
  const [qcOpen, setQcOpen] = useState(false);
  const [qcName, setQcName] = useState("");
  const [qcEmail, setQcEmail] = useState("");
  const [qcCountry, setQcCountry] = useState("BE");
  const [qcSubmitting, setQcSubmitting] = useState(false);

  async function quickCreateCustomer() {
    const name = qcName.trim();
    const email = qcEmail.trim().toLowerCase();
    const country = qcCountry.trim().toUpperCase() || "BE";
    if (!name) return toast.error("Nom requis");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Email invalide");
    if (!/^[A-Z]{2}$/.test(country)) return toast.error("Code pays ISO 2 lettres (ex. BE, FR, LU)");
    setQcSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_name: name,
          email,
          country_code: country,
          // NOT NULL placeholders — à compléter ensuite dans la fiche client si besoin
          address_line1: "—",
          city: "—",
          postal_code: "—",
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

  const totals = useMemo(() => {
    let excl = 0;
    let incl = 0;
    for (const l of lines) {
      const lineExcl = (l.unit_price_excl_vat || 0) * (l.quantity || 0);
      const lineIncl = lineExcl * (1 + (l.vat_rate || 0) / 100);
      excl += lineExcl;
      incl += lineIncl;
    }
    return { excl, incl, vat: incl - excl };
  }, [lines]);

  // group by vendor for commission
  const vendorIdsInLines = useMemo(() => {
    const s = new Set<string>();
    lines.forEach((l) => l.vendor_id && s.add(l.vendor_id));
    return Array.from(s);
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
    // simple lookup by product name; returns first 10 active offers
    if (!term || term.length < 2) return [] as any[];
    const { data } = await supabase
      .from("offers")
      .select("id, vendor_id, product_id, base_price_excl_vat, products!inner(name)")
      .eq("is_active", true)
      .ilike("products.name", `%${term}%`)
      .limit(10);
    return data ?? [];
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
      if (l.mode === "offer" && !l.offer_id)
        return toast.error("Sélectionne une offre pour chaque ligne 'offre'");
      if (!(l.quantity > 0)) return toast.error("Quantité invalide");
      if (!(l.unit_price_excl_vat >= 0)) return toast.error("Prix HTVA invalide");
    }

    const payload = {
      customer_id: customerId,
      status,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      admin_notes: adminNotes || null,
      lines: lines.map((l) => ({
        vendor_id: l.vendor_id,
        offer_id: l.mode === "offer" ? l.offer_id : null,
        product_id: l.mode === "offer" ? l.product_id : null,
        manual_label: l.mode === "free" ? l.manual_label : null,
        quantity: l.quantity,
        unit_price_excl_vat: l.unit_price_excl_vat,
        vat_rate: l.vat_rate,
      })),
      commissions: Object.fromEntries(
        Object.entries(commissions).map(([vid, c]) => [
          vid,
          { rate: c.rate || "", amount: c.amount || "" },
        ]),
      ),
    };

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_manual_order", {
        _payload: payload as any,
      });
      if (error) throw error;
      const result = data as any;
      toast.success(`Commande ${result?.order_number ?? ""} créée`);
      navigate("/admin/commandes");
    } catch (e: any) {
      toast.error("Échec : " + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AdminTopBar
        title="Nouvelle commande manuelle"
        subtitle="Saisie admin — alimente la GMV"
      />

      <div className="mb-4">
        <Link to="/admin/commandes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Retour aux commandes
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: meta */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="font-semibold text-sm">Acheteur</h3>
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

          {vendorIdsInLines.length > 0 && (
            <div className="bg-white rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="font-semibold text-sm">Commission (optionnelle, par vendeur)</h3>
              <p className="text-xs text-muted-foreground">
                Laisse vide pour ne pas calculer de commission sur cette commande manuelle. Renseigne <b>taux %</b> OU <b>montant fixe</b>.
              </p>
              {vendorIdsInLines.map((vid) => {
                const v = (vendors as any[]).find((x) => x.id === vid);
                const c = commissions[vid] ?? { rate: "", amount: "" };
                return (
                  <div key={vid} className="grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-1 text-sm">{v?.name ?? v?.company_name ?? vid.slice(0, 8)}</div>
                    <div>
                      <Label className="text-xs">Taux %</Label>
                      <Input
                        type="number" step="0.01" min="0" max="100"
                        value={c.rate}
                        onChange={(e) => setCommissions((prev) => ({ ...prev, [vid]: { ...c, rate: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Montant fixe €</Label>
                      <Input
                        type="number" step="0.01" min="0"
                        value={c.amount}
                        onChange={(e) => setCommissions((prev) => ({ ...prev, [vid]: { ...c, amount: e.target.value } }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex justify-between text-sm">
              <span>Sous-total HTVA</span>
              <span className="font-semibold">{totals.excl.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>TVA</span>
              <span>{totals.vat.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-base mt-2 pt-2 border-t">
              <span className="font-semibold">Total TTC</span>
              <span className="font-bold">{totals.incl.toFixed(2)} €</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/commandes")}>Annuler</Button>
            <Button onClick={submit} disabled={submitting}>
              <Save size={14} className="mr-1" />
              {submitting ? "Création…" : "Créer la commande"}
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
            <Label className="text-xs">Offre (recherche produit)</Label>
            <Input
              placeholder="Tape le nom d'un produit…"
              value={offerSearch}
              onChange={async (e) => {
                const v = e.target.value;
                setOfferSearch(v);
                const r = await searchOffers(line, v);
                setOfferResults(r);
              }}
            />
            {offerResults.length > 0 && !line.offer_id && (
              <div className="mt-1 max-h-40 overflow-auto border rounded">
                {offerResults.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="block w-full text-left text-xs px-2 py-1 hover:bg-muted"
                    onClick={() => {
                      onPatch({
                        offer_id: o.id,
                        product_id: o.product_id,
                        vendor_id: line.vendor_id || o.vendor_id,
                        unit_price_excl_vat: Number(o.base_price_excl_vat ?? 0),
                        offer_label: o.products?.name,
                      });
                      setOfferResults([]);
                      setOfferSearch(o.products?.name ?? "");
                    }}
                  >
                    {o.products?.name} — {Number(o.base_price_excl_vat ?? 0).toFixed(2)} €
                  </button>
                ))}
              </div>
            )}
            {line.offer_id && (
              <div className="mt-1 text-xs text-muted-foreground">
                Offre liée : {line.offer_label} ·{" "}
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
    </div>
  );
}

export default AdminCommandeManuelle;
