import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Trash2, Save, ShieldCheck, X, Pencil } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";

type AuthType = "authorized_distributor" | "manufacturer" | "exclusive_distributor" | "official_reseller";

interface VendorLite { id: string; name: string | null; company_name: string | null; }
interface BrandLite { id: string; name: string | null; }
interface AuthorizationRow {
  id: string;
  vendor_id: string;
  brand_id: string | null;
  authorization_type: AuthType;
  document_reference: string | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "authorized_distributor", label: "Distributeur autorisé" },
  { value: "manufacturer", label: "Fabricant" },
  { value: "exclusive_distributor", label: "Distributeur exclusif" },
  { value: "official_reseller", label: "Revendeur officiel" },
];

interface FormState {
  id: string | null;
  brand_id: string;
  authorization_type: AuthType;
  document_reference: string;
  valid_from: string;
  valid_until: string;
  notes: string;
}
const EMPTY_FORM: FormState = {
  id: null,
  brand_id: "",
  authorization_type: "authorized_distributor",
  document_reference: "",
  valid_from: "",
  valid_until: "",
  notes: "",
};

export default function AdminVendorBrandAuthorizations() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vba-vendors"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as VendorLite[];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["admin-vba-brands"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as BrandLite[];
    },
  });
  const brandMap = useMemo(() => {
    const m = new Map<string, string>();
    brands.forEach((b) => m.set(b.id, b.name ?? "—"));
    return m;
  }, [brands]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-vba-rows", vendorId],
    enabled: isAdmin && !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_brand_authorizations")
        .select("id, vendor_id, brand_id, authorization_type, document_reference, valid_from, valid_until, notes, created_at, updated_at")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AuthorizationRow[];
    },
  });

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) => (v.name ?? "").toLowerCase().includes(q) || (v.company_name ?? "").toLowerCase().includes(q)
    );
  }, [vendors, vendorSearch]);

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands.slice(0, 200);
    return brands.filter((b) => (b.name ?? "").toLowerCase().includes(q)).slice(0, 200);
  }, [brands, brandSearch]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setBrandSearch("");
    setShowForm(true);
  };
  const openEdit = (r: AuthorizationRow) => {
    setForm({
      id: r.id,
      brand_id: r.brand_id ?? "",
      authorization_type: r.authorization_type,
      document_reference: r.document_reference ?? "",
      valid_from: r.valid_from ?? "",
      valid_until: r.valid_until ?? "",
      notes: r.notes ?? "",
    });
    setBrandSearch(brandMap.get(r.brand_id ?? "") ?? "");
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setForm(EMPTY_FORM); };

  const save = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("Sélectionnez un vendeur");
      if (!form.brand_id) throw new Error("Marque requise");
      const payload = {
        vendor_id: vendorId,
        brand_id: form.brand_id,
        authorization_type: form.authorization_type,
        document_reference: form.document_reference.trim() || null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from("vendor_brand_authorizations").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vendor_brand_authorizations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Autorisation mise à jour" : "Autorisation ajoutée");
      qc.invalidateQueries({ queryKey: ["admin-vba-rows", vendorId] });
      closeForm();
    },
    onError: (e: any) => toast.error("Erreur", { description: e?.message ?? String(e) }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_brand_authorizations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Autorisation supprimée");
      qc.invalidateQueries({ queryKey: ["admin-vba-rows", vendorId] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e?.message ?? String(e) }),
  });

  if (authLoading) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: "#1D2530" }}>
            Autorisations de distribution par marque
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Documente, par vendeur et par marque, les droits de distribution (contrat, licence, exclusivité).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Vendor picker */}
        <div className="col-span-12 md:col-span-4 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="p-3 border-b border-[#E2E8F0]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Rechercher un vendeur…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          <ul className="max-h-[600px] overflow-y-auto text-sm">
            {filteredVendors.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => { setVendorId(v.id); closeForm(); }}
                  className={`w-full text-left px-3 py-2 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] ${vendorId === v.id ? "bg-[#EFF6FF] font-semibold" : ""}`}
                >
                  <div>{v.name ?? "—"}</div>
                  {v.company_name && v.company_name !== v.name && (
                    <div className="text-[11px] text-muted-foreground">{v.company_name}</div>
                  )}
                </button>
              </li>
            ))}
            {filteredVendors.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">Aucun vendeur</li>
            )}
          </ul>
        </div>

        {/* Right pane */}
        <div className="col-span-12 md:col-span-8 space-y-4">
          {!vendorId && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-sm text-muted-foreground">
              Sélectionnez un vendeur pour afficher ses autorisations.
            </div>
          )}

          {vendorId && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{selectedVendor?.name ?? "—"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {rows.length} autorisation{rows.length > 1 ? "s" : ""} enregistrée{rows.length > 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md bg-[#1B5BDA] text-white hover:bg-[#1747b0]"
                >
                  <Plus size={12} /> Nouvelle autorisation
                </button>
              </div>

              {showForm && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{form.id ? "Modifier l'autorisation" : "Nouvelle autorisation"}</h3>
                    <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs">Marque *</Label>
                      <Input
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        placeholder="Rechercher une marque…"
                        className="h-8 text-sm"
                      />
                      {brandSearch && !form.brand_id && (
                        <div className="border border-[#E2E8F0] rounded-md max-h-40 overflow-y-auto text-sm">
                          {filteredBrands.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => { setForm((f) => ({ ...f, brand_id: b.id })); setBrandSearch(b.name ?? ""); }}
                              className="w-full text-left px-3 py-1.5 hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0"
                            >
                              {b.name}
                            </button>
                          ))}
                          {filteredBrands.length === 0 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</div>
                          )}
                        </div>
                      )}
                      {form.brand_id && (
                        <p className="text-[11px] text-muted-foreground">
                          Sélectionné : <strong>{brandMap.get(form.brand_id)}</strong>{" "}
                          <button
                            onClick={() => { setForm((f) => ({ ...f, brand_id: "" })); setBrandSearch(""); }}
                            className="underline ml-1"
                          >
                            changer
                          </button>
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Type d'autorisation *</Label>
                      <Select
                        value={form.authorization_type}
                        onValueChange={(v) => setForm((f) => ({ ...f, authorization_type: v as AuthType }))}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUTH_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Référence document</Label>
                      <Input
                        value={form.document_reference}
                        onChange={(e) => setForm((f) => ({ ...f, document_reference: e.target.value }))}
                        placeholder="Ex : Contrat 2026-14 / Notion #ABC"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Valide du</Label>
                      <Input
                        type="date"
                        value={form.valid_from}
                        onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Valide jusqu'au</Label>
                      <Input
                        type="date"
                        value={form.valid_until}
                        onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs">Notes internes</Label>
                      <Textarea
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        placeholder="Ex : autorisation limitée à la BE, exclusivité 2 ans, etc."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                    <button onClick={closeForm} className="text-sm px-4 py-2 rounded-md border border-border hover:bg-muted">
                      Annuler
                    </button>
                    <button
                      onClick={() => save.mutate()}
                      disabled={save.isPending || !form.brand_id}
                      className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marque</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Validité</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Mise à jour</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
                    )}
                    {!isLoading && rows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune autorisation enregistrée.</TableCell></TableRow>
                    )}
                    {rows.map((r) => {
                      const typeLabel = AUTH_TYPES.find((t) => t.value === r.authorization_type)?.label ?? r.authorization_type;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{brandMap.get(r.brand_id ?? "") ?? "—"}</TableCell>
                          <TableCell>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1B5BDA]">
                              {typeLabel}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.valid_from || "—"} → {r.valid_until || "∞"}
                          </TableCell>
                          <TableCell className="text-xs">{r.document_reference ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatUpdatedAt(r.updated_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => openEdit(r)}
                                className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-muted-foreground hover:text-foreground"
                                title="Modifier"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => { if (confirm("Supprimer cette autorisation ?")) del.mutate(r.id); }}
                                className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600"
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
