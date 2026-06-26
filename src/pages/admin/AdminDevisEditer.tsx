import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, UserPlus } from "lucide-react";
import { fmtEur } from "@/lib/format-currency";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

type Line = {
  id?: string;
  product_id?: string | null;
  offer_id?: string | null;
  label: string;
  qty: number;
  unit_price_ht_cents: number;
  vat_rate: number;
  unit_cost_ht_cents?: number | null;
  commission_rate?: number | null;
};

const AdminDevisEditer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [vendorId, setVendorId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [validityDays, setValidityDays] = useState<number>(7);
  const [paymentMethod, setPaymentMethod] = useState<string>("invoice");
  const [notesCustomer, setNotesCustomer] = useState("");
  const [notesInternal, setNotesInternal] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const [vendorSearch, setVendorSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  // Quick-create customer
  const [qcOpen, setQcOpen] = useState(false);
  const [qcName, setQcName] = useState("");
  const [qcEmail, setQcEmail] = useState("");
  const [qcCountry, setQcCountry] = useState("BE");
  const [qcAddressLine1, setQcAddressLine1] = useState("");
  const [qcCity, setQcCity] = useState("");
  const [qcPostalCode, setQcPostalCode] = useState("");
  const [qcVatNumber, setQcVatNumber] = useState("");
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
        })
        .select("id, company_name, email")
        .single();
      if (error) throw error;
      toast.success(`Client « ${data.company_name} » créé`);
      await queryClient.invalidateQueries({ queryKey: ["admin-customers-list"] });
      setCustomerId(data.id);
      setCustomerSearch(data.company_name);
      setQcOpen(false);
      setQcName(""); setQcEmail(""); setQcCountry("BE");
      setQcAddressLine1(""); setQcCity(""); setQcPostalCode(""); setQcVatNumber("");
    } catch (e: any) {
      toast.error("Échec création : " + (e?.message ?? String(e)));
    } finally {
      setQcSubmitting(false);
    }
  }

  const { data: quote, isLoading } = useQuery({
    queryKey: ["admin-quote-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, lines:quote_lines(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vendors-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name")
        .order("company_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["admin-customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, company_name, email, vat_number")
        .order("company_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (!quote) return;
    setVendorId(quote.vendor_id || "");
    setCustomerId(quote.customer_id || "");
    setPaymentMethod(quote.payment_method || "invoice");
    setNotesCustomer(quote.notes_customer || "");
    setNotesInternal(quote.notes_internal || "");
    const sorted = [...(quote.lines || [])].sort(
      (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    setLines(
      sorted.map((l: any) => ({
        id: l.id,
        product_id: l.product_id,
        offer_id: l.offer_id,
        label: l.label,
        qty: Number(l.qty || 1),
        unit_price_ht_cents: Number(l.unit_price_ht_cents || 0),
        vat_rate: Number(l.vat_rate || 21),
        unit_cost_ht_cents: l.unit_cost_ht_cents,
        commission_rate: l.commission_rate != null ? Number(l.commission_rate) : null,
      }))
    );
  }, [quote]);

  const filteredVendors = useMemo(() => {
    const s = vendorSearch.toLowerCase().trim();
    if (!s) return vendors.slice(0, 50);
    return vendors
      .filter((v: any) =>
        `${v.company_name || ""} ${v.name || ""}`.toLowerCase().includes(s)
      )
      .slice(0, 50);
  }, [vendors, vendorSearch]);

  const filteredCustomers = useMemo(() => {
    const s = customerSearch.toLowerCase().trim();
    if (!s) return customers.slice(0, 50);
    return customers
      .filter((c: any) =>
        `${c.company_name || ""} ${c.email || ""} ${c.vat_number || ""}`
          .toLowerCase()
          .includes(s)
      )
      .slice(0, 50);
  }, [customers, customerSearch]);

  const totals = useMemo(() => {
    let ht = 0;
    let tva = 0;
    lines.forEach((l) => {
      const lineHt = l.qty * l.unit_price_ht_cents;
      ht += lineHt;
      tva += Math.round((lineHt * l.vat_rate) / 100);
    });
    return { ht, tva, ttc: ht + tva };
  }, [lines]);

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { label: "", qty: 1, unit_price_ht_cents: 0, vat_rate: 21 },
    ]);
  };
  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!vendorId || !customerId) {
      toast.error("Vendeur et client requis");
      return;
    }
    if (lines.length === 0) {
      toast.error("Au moins une ligne requise");
      return;
    }
    if (lines.some((l) => !l.label.trim())) {
      toast.error("Toutes les lignes doivent avoir un libellé");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vendor_id: vendorId,
        customer_id: customerId,
        payment_method: paymentMethod,
        validity_days: validityDays,
        notes_customer: notesCustomer || null,
        notes_internal: notesInternal || null,
        lines: lines.map((l, i) => ({
          product_id: l.product_id || null,
          offer_id: l.offer_id || null,
          label: l.label,
          qty: l.qty,
          unit_price_ht_cents: l.unit_price_ht_cents,
          vat_rate: l.vat_rate,
          unit_cost_ht_cents: l.unit_cost_ht_cents ?? null,
          sort_order: i + 1,
        })),
      };
      const { error } = await supabase.rpc("admin_update_quote_from_payload" as any, {
        _quote_id: id,
        _payload: payload,
      });
      if (error) throw error;
      toast.success("Devis mis à jour");
      await queryClient.invalidateQueries({ queryKey: ["admin-quote", id] });
      await queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      navigate(`/admin/devis/${id}`);
    } catch (e: any) {
      toast.error(e?.message || "Échec mise à jour");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-6 text-slate-500">Chargement…</div>;
  if (!quote)
    return (
      <div className="p-6 text-slate-500">
        Devis introuvable. <Link to="/admin/devis" className="text-sky-600">Retour</Link>
      </div>
    );

  if (quote.status !== "draft") {
    return (
      <div>
        <AdminTopBar title={`Devis ${quote.quote_number}`} subtitle="Édition impossible" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
          Seuls les devis en brouillon peuvent être édités. Statut actuel :{" "}
          <strong>{quote.status}</strong>. Vous pouvez dupliquer ce devis pour repartir d'un
          brouillon.
        </div>
        <div className="mt-4">
          <Link to={`/admin/devis/${id}`} className="text-sky-600 text-sm">
            ← Retour à la fiche
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminTopBar
        title={`Éditer ${quote.quote_number}`}
        subtitle="Modifier le client, le vendeur, les lignes et les conditions"
      />

      <div className="mb-4">
        <Link
          to={`/admin/devis/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={14} /> Retour à la fiche
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendeur</Label>
                <Input
                  placeholder="Rechercher un vendeur…"
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  className="mb-1"
                />
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— sélectionner —</option>
                  {filteredVendors.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name || v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Client</Label>
                  <button
                    type="button"
                    onClick={() => setQcOpen(true)}
                    className="text-[11px] text-sky-700 hover:underline inline-flex items-center gap-1"
                  >
                    <UserPlus size={12} /> Nouveau client
                  </button>
                </div>
                <Input
                  placeholder="Rechercher un client…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="mb-1"
                />
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— sélectionner —</option>
                  {filteredCustomers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} {c.vat_number ? `· ${c.vat_number}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Méthode paiement</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="invoice">Facture</option>
                  <option value="card">Carte (Stripe)</option>
                  <option value="bank_transfer">Virement</option>
                </select>
              </div>
              <div>
                <Label>Validité (jours)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value) || 7)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="p-3 flex items-center justify-between border-b">
              <div className="text-sm font-semibold">Lignes</div>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus size={14} className="mr-1" /> Ajouter une ligne
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-2 py-2 text-[11px] uppercase text-slate-500">Libellé</th>
                  <th className="text-right px-2 py-2 text-[11px] uppercase text-slate-500 w-20">Qté</th>
                  <th className="text-right px-2 py-2 text-[11px] uppercase text-slate-500 w-32">PU HT (€)</th>
                  <th className="text-right px-2 py-2 text-[11px] uppercase text-slate-500 w-20">TVA %</th>
                  <th className="text-right px-2 py-2 text-[11px] uppercase text-slate-500 w-28">Total HT</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const lineHt = l.qty * l.unit_price_ht_cents;
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        <Input
                          value={l.label}
                          onChange={(e) => updateLine(i, { label: e.target.value })}
                          placeholder="Article"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          min={1}
                          value={l.qty}
                          onChange={(e) => updateLine(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                          className="text-right"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={(l.unit_price_ht_cents / 100).toString()}
                          onChange={(e) =>
                            updateLine(i, {
                              unit_price_ht_cents: Math.round((Number(e.target.value) || 0) * 100),
                            })
                          }
                          className="text-right"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={l.vat_rate}
                          onChange={(e) => updateLine(i, { vat_rate: Number(e.target.value) || 0 })}
                          className="text-right"
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-medium">{fmtEur(lineHt / 100)} €</td>
                      <td className="px-2 py-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeLine(i)}
                          disabled={lines.length <= 1}
                          title="Supprimer la ligne"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/40">
                <tr className="border-t">
                  <td colSpan={4} className="px-3 py-2 text-right text-slate-500">Total HT</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtEur(totals.ht / 100)} €</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-slate-500">TVA</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtEur(totals.tva / 100)} €</td>
                  <td />
                </tr>
                <tr className="border-t bg-[#1C58D9] text-white">
                  <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total TTC</td>
                  <td className="px-3 py-2 text-right font-bold">{fmtEur(totals.ttc / 100)} €</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white border rounded-lg p-4 space-y-3">
            <div>
              <Label>Notes acheteur (visible sur le PDF / page web)</Label>
              <Textarea
                value={notesCustomer}
                onChange={(e) => setNotesCustomer(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Notes internes (privées)</Label>
              <Textarea
                value={notesInternal}
                onChange={(e) => setNotesInternal(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4 space-y-2 sticky top-4">
            <div className="text-sm font-semibold mb-2">Actions</div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full justify-center"
              style={{ backgroundColor: "#1C58D9", color: "#fff" }}
            >
              <Save size={14} className="mr-2" />
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/devis/${id}`)}
              className="w-full"
              disabled={saving}
            >
              Annuler
            </Button>
            <div className="text-xs text-slate-500 pt-2 border-t mt-2">
              Le PDF sera à re-générer après modification.
            </div>
          </div>
        </div>
      </div>

      <Dialog open={qcOpen} onOpenChange={setQcOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un client rapide</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nom / raison sociale *</Label>
              <Input value={qcName} onChange={(e) => setQcName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={qcEmail} onChange={(e) => setQcEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">N° TVA (optionnel)</Label>
                <Input value={qcVatNumber} onChange={(e) => setQcVatNumber(e.target.value)} placeholder="BE0123456789" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Adresse ligne 1 *</Label>
              <Input value={qcAddressLine1} onChange={(e) => setQcAddressLine1(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">CP *</Label>
                <Input value={qcPostalCode} onChange={(e) => setQcPostalCode(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Ville *</Label>
                <Input value={qcCity} onChange={(e) => setQcCity(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Pays (ISO 2) *</Label>
              <Input value={qcCountry} onChange={(e) => setQcCountry(e.target.value.toUpperCase())} maxLength={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQcOpen(false)} disabled={qcSubmitting}>Annuler</Button>
            <Button onClick={quickCreateCustomer} disabled={qcSubmitting} style={{ backgroundColor: "#1C58D9", color: "#fff" }}>
              {qcSubmitting ? "Création…" : "Créer le client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDevisEditer;
