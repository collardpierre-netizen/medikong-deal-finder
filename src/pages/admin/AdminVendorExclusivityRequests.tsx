import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, Check, X, Loader2, Search } from "lucide-react";

type Scope = "brand" | "manufacturer" | "product" | "category";
type Mode = "showcase" | "hide" | "block";
type ReqStatus = "pending" | "approved" | "rejected" | "cancelled";

interface RequestRow {
  id: string;
  vendor_id: string;
  requested_by: string | null;
  mode: Mode;
  scope_type: Scope;
  scope_id: string | null;
  scope_label: string | null;
  country_codes: string[];
  valid_from: string | null;
  valid_until: string | null;
  message: string | null;
  status: ReqStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_exclusivity_id: string | null;
  created_at: string;
}

interface VendorMini { id: string; name: string | null; company_name: string | null; display_code: string | null; }

const SCOPE_TABLE: Record<Scope, "brands" | "manufacturers" | "products" | "categories"> = {
  brand: "brands", manufacturer: "manufacturers", product: "products", category: "categories",
};
const SCOPE_LABEL: Record<Scope, string> = { brand: "Marque", manufacturer: "Fabricant", product: "Produit", category: "Catégorie" };
const MODE_LABEL: Record<Mode, string> = { showcase: "Mise en avant", hide: "Masquer concurrents", block: "Bloquer concurrents" };
const MODE_VARIANT: Record<Mode, "default" | "secondary" | "destructive"> = { showcase: "default", hide: "secondary", block: "destructive" };
const STATUS_VARIANT: Record<ReqStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary", approved: "default", rejected: "destructive", cancelled: "outline",
};

export default function AdminVendorExclusivityRequests() {
  const [statusFilter, setStatusFilter] = useState<ReqStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<RequestRow | null>(null);

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-vendor-exclusivity-requests", statusFilter],
    queryFn: async () => {
      let q = supabase.from("vendor_exclusivity_requests" as any).select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as RequestRow[];
    },
  });

  const vendorIds = useMemo(() => Array.from(new Set(requests.map((r) => r.vendor_id))), [requests]);

  const { data: vendorMap = new Map<string, VendorMini>() } = useQuery({
    queryKey: ["admin-vendors-mini", vendorIds],
    enabled: vendorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, display_code")
        .in("id", vendorIds);
      if (error) throw error;
      const m = new Map<string, VendorMini>();
      (data || []).forEach((v: any) => m.set(v.id, v));
      return m;
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return requests;
    return requests.filter((r) => {
      const v = vendorMap.get(r.vendor_id);
      const hay = [
        v?.name, v?.company_name, v?.display_code, r.scope_label, r.message,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s);
    });
  }, [requests, vendorMap, search]);

  const counts = useMemo(() => {
    const c: Record<ReqStatus | "all", number> = { all: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    requests.forEach((r) => { c.all++; c[r.status]++; });
    return c;
  }, [requests]);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <Helmet><title>Demandes d'exclusivité — Admin MediKong</title></Helmet>

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Demandes d'exclusivité vendeur
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Examiner les demandes envoyées par les vendeurs et créer les règles correspondantes dans <code>vendor_exclusivities</code>.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="pending">En attente ({counts.pending})</TabsTrigger>
                <TabsTrigger value="approved">Approuvées ({counts.approved})</TabsTrigger>
                <TabsTrigger value="rejected">Refusées ({counts.rejected})</TabsTrigger>
                <TabsTrigger value="cancelled">Annulées ({counts.cancelled})</TabsTrigger>
                <TabsTrigger value="all">Toutes ({counts.all})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Vendeur, cible, message…" className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Aucune demande.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <RequestCard key={r.id} row={r} vendor={vendorMap.get(r.vendor_id)} onOpen={() => setEditing(r)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <ReviewDialog
          row={editing}
          vendor={vendorMap.get(editing.vendor_id)}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); refetch(); }}
        />
      )}
    </div>
  );
}

function RequestCard({
  row, vendor, onOpen,
}: { row: RequestRow; vendor: VendorMini | undefined; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left border rounded-lg p-3 bg-card hover:bg-accent/40 transition"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
            <Badge variant={MODE_VARIANT[row.mode]}>{MODE_LABEL[row.mode]}</Badge>
            <Badge variant="outline">{SCOPE_LABEL[row.scope_type]}</Badge>
            <span className="font-medium text-sm">{row.scope_label || "—"}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-medium text-foreground">
              {vendor?.company_name || vendor?.name || "Vendeur"} {vendor?.display_code ? `· ${vendor.display_code}` : ""}
            </span>
            <span>
              {row.valid_from ? new Date(row.valid_from).toLocaleDateString("fr-FR") : "?"} →{" "}
              {row.valid_until ? new Date(row.valid_until).toLocaleDateString("fr-FR") : "?"}
            </span>
            {row.country_codes.length > 0 && <span>{row.country_codes.join(", ")}</span>}
            <span>Reçue le {new Date(row.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ReviewDialog({
  row, vendor, onClose, onDone,
}: { row: RequestRow; vendor: VendorMini | undefined; onClose: () => void; onDone: () => void }) {
  const [scopeId, setScopeId] = useState<string>(row.scope_id || "");
  const [searchQ, setSearchQ] = useState(row.scope_label || "");
  const [validFrom, setValidFrom] = useState(row.valid_from?.slice(0, 10) || "");
  const [validUntil, setValidUntil] = useState(row.valid_until?.slice(0, 10) || "");
  const [countries, setCountries] = useState((row.country_codes || []).join(", "));
  const [notes, setNotes] = useState(row.admin_notes || "");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const { data: candidates = [] } = useQuery({
    queryKey: ["admin-excl-scope-search", row.scope_type, searchQ],
    enabled: searchQ.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(SCOPE_TABLE[row.scope_type])
        .select("id, name")
        .ilike("name", `%${searchQ.trim()}%`)
        .limit(15);
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  const canApprove = !!scopeId && !!validFrom && !!validUntil;

  async function handleApprove() {
    if (!canApprove) {
      toast({ title: "Champs requis", description: "Sélectionnez la cible et la période.", variant: "destructive" });
      return;
    }
    setBusy("approve");
    const { data: { user } } = await supabase.auth.getUser();
    const countryArr = countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

    const payload: any = {
      vendor_id: row.vendor_id,
      scope: row.scope_type,
      brand_id: row.scope_type === "brand" ? scopeId : null,
      manufacturer_id: row.scope_type === "manufacturer" ? scopeId : null,
      product_id: row.scope_type === "product" ? scopeId : null,
      category_id: row.scope_type === "category" ? scopeId : null,
      mode: row.mode,
      valid_from: validFrom,
      valid_until: validUntil,
      country_codes: countryArr.length > 0 ? countryArr : null,
      reason: row.message,
      created_by: user?.id,
      is_active: true,
    };

    const { data: created, error: insertErr } = await supabase
      .from("vendor_exclusivities" as any)
      .insert(payload)
      .select("id")
      .single();

    if (insertErr) {
      setBusy(null);
      toast({ title: "Création impossible", description: insertErr.message, variant: "destructive" });
      return;
    }

    const { error: updErr } = await supabase
      .from("vendor_exclusivity_requests" as any)
      .update({
        status: "approved",
        admin_notes: notes || null,
        scope_id: scopeId,
        country_codes: countryArr,
        valid_from: validFrom,
        valid_until: validUntil,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        created_exclusivity_id: (created as any)?.id || null,
      })
      .eq("id", row.id);

    setBusy(null);
    if (updErr) {
      toast({ title: "Demande créée mais update échoué", description: updErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Demande approuvée", description: "Règle d'exclusivité créée." });
    onDone();
  }

  async function handleReject() {
    setBusy("reject");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("vendor_exclusivity_requests" as any)
      .update({
        status: "rejected",
        admin_notes: notes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setBusy(null);
    if (error) {
      toast({ title: "Refus impossible", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Demande refusée" });
    onDone();
  }

  const isFinal = row.status !== "pending";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Demande d'exclusivité — {vendor?.company_name || vendor?.name || "Vendeur"}</DialogTitle>
          <DialogDescription className="flex gap-2 flex-wrap pt-1">
            <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
            <Badge variant={MODE_VARIANT[row.mode]}>{MODE_LABEL[row.mode]}</Badge>
            <Badge variant="outline">{SCOPE_LABEL[row.scope_type]}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {row.message && (
            <div className="border rounded-md p-3 bg-muted/40">
              <div className="text-xs text-muted-foreground mb-1">Message vendeur</div>
              <p className="text-sm whitespace-pre-wrap">{row.message}</p>
            </div>
          )}

          <div>
            <Label>Cible demandée</Label>
            <p className="text-sm font-medium mb-2">"{row.scope_label || "—"}"</p>
            <Label className="text-xs">Rechercher la {SCOPE_LABEL[row.scope_type].toLowerCase()} à associer</Label>
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Tapez 2+ caractères" disabled={isFinal} />
            {candidates.length > 0 && !isFinal && (
              <div className="border rounded-md mt-1 max-h-40 overflow-auto">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setScopeId(c.id); setSearchQ(c.name); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${scopeId === c.id ? "bg-accent" : ""}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {scopeId && (
              <p className="text-xs text-muted-foreground mt-1">ID sélectionné : <code>{scopeId}</code></p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Du</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={isFinal} />
            </div>
            <div>
              <Label>Au</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={isFinal} />
            </div>
          </div>

          <div>
            <Label>Pays <span className="text-muted-foreground text-xs">(ISO 2 lettres, virgule)</span></Label>
            <Input value={countries} onChange={(e) => setCountries(e.target.value)} disabled={isFinal} />
          </div>

          <div>
            <Label>Notes admin (visible vendeur)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={isFinal} />
          </div>
        </div>

        <DialogFooter>
          {isFinal ? (
            <Button variant="outline" onClick={onClose}>Fermer</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleReject} disabled={busy !== null}>
                {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                Refuser
              </Button>
              <Button onClick={handleApprove} disabled={busy !== null || !canApprove}>
                {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Approuver & créer la règle
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
