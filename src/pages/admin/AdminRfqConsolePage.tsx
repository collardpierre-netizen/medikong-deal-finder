import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Search, ExternalLink, BellRing, UserPlus, RefreshCw, Eye, Send } from "lucide-react";
import { RfqDispatchTracker } from "@/components/rfq/RfqDispatchTracker";

type RfqStatus = "draft" | "dispatched" | "in_followup" | "closed" | "awarded" | "cancelled";

interface RfqRow {
  id: string;
  status: RfqStatus;
  created_at: string;
  responses_deadline: string;
  quantity: number;
  destination_country_code: string;
  currency_code: string;
  total_targeted: number;
  total_responded: number;
  product_id: string | null;
  brand_id: string | null;
  buyer_user_id: string;
  current_wave: number;
}

const STATUS_META: Record<RfqStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "outline" },
  dispatched: { label: "Diffusée", variant: "secondary" },
  in_followup: { label: "En relance", variant: "default" },
  closed: { label: "Clôturée", variant: "outline" },
  awarded: { label: "Attribuée", variant: "default" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

export default function AdminRfqConsolePage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | RfqStatus>("all");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [addVendorOpen, setAddVendorOpen] = useState(false);

  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ["admin-rfq-list", statusFilter, country],
    queryFn: async () => {
      let q = supabase
        .from("rfqs")
        .select("id, status, created_at, responses_deadline, quantity, destination_country_code, currency_code, total_targeted, total_responded, product_id, brand_id, buyer_user_id, current_wave")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (country !== "all") q = q.eq("destination_country_code", country);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RfqRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rfqs;
    const s = search.toLowerCase().trim();
    return rfqs.filter((r) => r.id.toLowerCase().includes(s));
  }, [rfqs, search]);

  const kpis = useMemo(() => {
    const open = rfqs.filter((r) => ["dispatched", "in_followup"].includes(r.status));
    const respondedSum = rfqs.reduce((s, r) => s + (r.total_responded || 0), 0);
    const targetedSum = rfqs.reduce((s, r) => s + (r.total_targeted || 0), 0);
    const responseRate = targetedSum > 0 ? Math.round((respondedSum / targetedSum) * 100) : 0;
    return {
      total: rfqs.length,
      open: open.length,
      awarded: rfqs.filter((r) => r.status === "awarded").length,
      responseRate,
    };
  }, [rfqs]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Helmet>
        <title>Console RFQ — Admin MediKong</title>
      </Helmet>

      <div>
        <h1 className="text-3xl font-bold">Console RFQ</h1>
        <p className="text-muted-foreground mt-1">
          Pilotage des demandes de prix : suivi, relances manuelles, ajout de vendeurs.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="RFQ (200 dernières)" value={kpis.total} />
        <KpiCard label="En cours" value={kpis.open} />
        <KpiCard label="Attribuées" value={kpis.awarded} />
        <KpiCard label="Taux de réponse" value={`${kpis.responseRate}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demandes</CardTitle>
          <CardDescription>Filtrez puis cliquez sur une ligne pour ouvrir le détail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative md:w-[280px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 font-mono text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="md:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(STATUS_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="md:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les pays</SelectItem>
                <SelectItem value="BE">Belgique</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="LU">Luxembourg</SelectItem>
                <SelectItem value="NL">Pays-Bas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["admin-rfq-list"] })}>
              <RefreshCw className="h-4 w-4 mr-2" /> Recharger
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune RFQ.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créée</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead>Pays</TableHead>
                    <TableHead className="text-right">Ciblés</TableHead>
                    <TableHead className="text-right">Réponses</TableHead>
                    <TableHead className="text-right">Vague</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedRfqId(r.id)}
                      >
                        <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}…</TableCell>
                        <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell className="text-xs">{new Date(r.responses_deadline).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell className="text-right">{r.quantity}</TableCell>
                        <TableCell>{r.destination_country_code}</TableCell>
                        <TableCell className="text-right">{r.total_targeted}</TableCell>
                        <TableCell className="text-right font-semibold">{r.total_responded}</TableCell>
                        <TableCell className="text-right">{r.current_wave}</TableCell>
                        <TableCell><Eye className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRfqId} onOpenChange={(o) => !o && setSelectedRfqId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedRfqId && (
            <RfqDetailPanel
              rfqId={selectedRfqId}
              onOpenReminder={() => setReminderOpen(true)}
              onOpenAddVendor={() => setAddVendorOpen(true)}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedRfqId && (
        <>
          <ReminderModal
            rfqId={selectedRfqId}
            open={reminderOpen}
            onClose={() => setReminderOpen(false)}
          />
          <AddVendorModal
            rfqId={selectedRfqId}
            open={addVendorOpen}
            onClose={() => setAddVendorOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function RfqDetailPanel({
  rfqId,
  onOpenReminder,
  onOpenAddVendor,
}: {
  rfqId: string;
  onOpenReminder: () => void;
  onOpenAddVendor: () => void;
}) {
  const { data: rfq } = useQuery({
    queryKey: ["admin-rfq-detail", rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfqs")
        .select("*, products(name, gtin, cnk_code, pack_size, slug, image_url), brands(name, slug)")
        .eq("id", rfqId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: buyer } = useQuery({
    enabled: !!rfq?.buyer_user_id,
    queryKey: ["admin-rfq-buyer", rfq?.buyer_user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, company_name, country, vat_number, buyer_profile_id, profession_type_id, buyer_profiles:buyer_profile_id(label), profession_types:profession_type_id(name)")
        .eq("user_id", rfq!.buyer_user_id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: responses = [] } = useQuery({
    queryKey: ["admin-rfq-responses", rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_responses")
        .select("id, vendor_id, status, unit_price_excl_vat_cents, total_excl_vat_cents, delivery_lead_days, score, is_top_pick, created_at, decline_reason, vendors:vendor_id(name, company_name)")
        .eq("rfq_id", rfqId)
        .order("score", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const qcDetail = useQueryClient();
  const dispatchMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("dispatch-rfq", { body: { rfq_id: rfqId } });
      if (error) throw error;
      return data as { vendors_targeted: number; notifications_created: number };
    },
    onSuccess: (r) => {
      toast.success(`RFQ diffusée à ${r.vendors_targeted} vendeur(s) (${r.notifications_created} notification(s) créée(s)).`);
      qcDetail.invalidateQueries({ queryKey: ["admin-rfq-detail", rfqId] });
      qcDetail.invalidateQueries({ queryKey: ["admin-rfq-list"] });
      qcDetail.invalidateQueries({ queryKey: ["admin-rfq-dispatch-log", rfqId] });
    },
    onError: (e: any) => toast.error(`Échec diffusion : ${e?.message ?? "erreur inconnue"}`),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          RFQ <span className="font-mono text-sm text-muted-foreground">{rfqId.slice(0, 8)}…</span>
          {rfq && <Badge variant={STATUS_META[rfq.status as RfqStatus]?.variant ?? "outline"}>{STATUS_META[rfq.status as RfqStatus]?.label ?? rfq.status}</Badge>}
        </DialogTitle>
        <DialogDescription>
          {rfq?.products?.name || rfq?.brands?.name || "—"} · Qté {rfq?.quantity} · {rfq?.destination_country_code} · Échéance {rfq && new Date(rfq.responses_deadline).toLocaleDateString("fr-FR")}
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-2 flex-wrap">
        {rfq?.status === "draft" && (
          <Button
            size="sm"
            variant="default"
            onClick={() => dispatchMut.mutate()}
            disabled={dispatchMut.isPending}
          >
            {dispatchMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Diffuser maintenant
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onOpenReminder}>
          <BellRing className="h-4 w-4 mr-2" /> Relancer maintenant
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenAddVendor}>
          <UserPlus className="h-4 w-4 mr-2" /> Ajouter un vendeur
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={`/admin/rfq-routing-audit?rfq=${rfqId}`} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3 w-3 mr-1" /> Audit du routage
          </a>
        </Button>
      </div>

      {rfq && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex gap-3">
            {rfq.products?.image_url && (
              <img src={rfq.products.image_url} alt="" className="w-16 h-16 object-contain rounded border bg-background flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {rfq.products?.name ? (
                  <a href={`/produit/${rfq.products.slug}`} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                    {rfq.products.name} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : rfq.brands?.name ? (
                  <a href={`/marques/${rfq.brands.slug}`} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                    Marque : {rfq.brands.name} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {rfq.products?.gtin && <span>EAN <span className="font-mono">{rfq.products.gtin}</span></span>}
                {rfq.products?.cnk_code && <span>CNK <span className="font-mono">{rfq.products.cnk_code}</span></span>}
                {rfq.products?.pack_size && <span>Pack {rfq.products.pack_size}</span>}
                <span>Scope : {rfq.target_scope}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Quantité</div>
              <div className="font-medium">{rfq.quantity?.toLocaleString("fr-FR")} u.</div>
            </div>
            <div>
              <div className="text-muted-foreground">Prix cible HTVA</div>
              <div className="font-medium font-mono">{rfq.target_price_excl_vat_cents != null ? `${(rfq.target_price_excl_vat_cents / 100).toFixed(2)} ${rfq.currency_code}` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Pays livraison</div>
              <div className="font-medium">{rfq.destination_country_code}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Livraison souhaitée</div>
              <div className="font-medium">{rfq.desired_delivery_date ? new Date(rfq.desired_delivery_date).toLocaleDateString("fr-FR") : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Échéance réponses</div>
              <div className="font-medium">{new Date(rfq.responses_deadline).toLocaleDateString("fr-FR")}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Validité offre</div>
              <div className="font-medium">{rfq.required_offer_validity_days ? `${rfq.required_offer_validity_days} j` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Paiement</div>
              <div className="font-medium truncate" title={rfq.payment_terms ?? ""}>{rfq.payment_terms || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Vague</div>
              <div className="font-medium">{rfq.current_wave} / 2</div>
            </div>
          </div>

          {buyer && (
            <div className="pt-2 border-t text-xs">
              <div className="text-muted-foreground mb-1">Acheteur</div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="font-medium">{buyer.company_name || buyer.full_name || "—"}</span>
                {buyer.full_name && buyer.company_name && <span className="text-muted-foreground">· {buyer.full_name}</span>}
                {buyer.country && <span className="text-muted-foreground">· {buyer.country}</span>}
                {buyer.vat_number && <span className="text-muted-foreground">· TVA {buyer.vat_number}</span>}
                {buyer.profession_types?.name && <Badge variant="outline" className="h-4 text-[10px]">{buyer.profession_types.name}</Badge>}
                {buyer.buyer_profiles?.label && <Badge variant="secondary" className="h-4 text-[10px]">Profil prix : {buyer.buyer_profiles.label}</Badge>}
              </div>
            </div>
          )}

          {rfq.comment && (
            <div className="pt-2 border-t text-xs">
              <div className="text-muted-foreground mb-1">Commentaire acheteur</div>
              <div className="whitespace-pre-wrap">{rfq.comment}</div>
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="diffusion" className="mt-2">
        <TabsList>
          <TabsTrigger value="diffusion">Diffusion</TabsTrigger>
          <TabsTrigger value="responses">Réponses ({responses.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="diffusion" className="mt-4">
          <RfqDispatchTracker rfqId={rfqId} />
        </TabsContent>
        <TabsContent value="responses" className="mt-4">
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune réponse pour le moment.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendeur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Prix HTVA</TableHead>
                    <TableHead className="text-right">Total HTVA</TableHead>
                    <TableHead className="text-right">Délai</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.vendors?.company_name || r.vendors?.name || r.vendor_id.slice(0, 8)}</div>
                        {r.decline_reason && <div className="text-xs text-destructive">{r.decline_reason}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "submitted" ? "default" : "outline"}>{r.status}</Badge>
                        {r.is_top_pick && <Badge variant="default" className="ml-1">Top</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.unit_price_excl_vat_cents != null ? `${(r.unit_price_excl_vat_cents / 100).toFixed(2)} €` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.total_excl_vat_cents != null ? `${(r.total_excl_vat_cents / 100).toFixed(2)} €` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">{r.delivery_lead_days != null ? `${r.delivery_lead_days} j` : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.score != null ? r.score.toFixed(2) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

// ===== Reminder Modal =====
function ReminderModal({ rfqId, open, onClose }: { rfqId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState<string>("");
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());

  const { data: templates = [] } = useQuery({
    queryKey: ["rfq-reminder-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_reminder_templates")
        .select("id, wave_number, subject_fr, is_active")
        .eq("is_active", true)
        .order("wave_number");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["admin-rfq-reminder-candidates", rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_dispatch_log")
        .select("vendor_id, status, vendors:vendor_id(name, company_name)")
        .eq("rfq_id", rfqId)
        .in("status", ["dispatched", "viewed", "pending_review", "reminded"]);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error("Choisissez un template");
      if (selectedVendors.size === 0) throw new Error("Sélectionnez au moins un vendeur");
      const results = await Promise.all(
        [...selectedVendors].map((vendorId) =>
          supabase.rpc("rfq_admin_send_reminder_now" as never, {
            _rfq_id: rfqId,
            _vendor_id: vendorId,
            _template_id: templateId,
          } as never)
        )
      );
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw new Error(`${errors.length} envoi(s) en erreur`);
      return results.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} relance(s) envoyée(s)`);
      qc.invalidateQueries({ queryKey: ["rfq-dispatch-summary", rfqId] });
      onClose();
      setSelectedVendors(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAll = () => {
    if (selectedVendors.size === candidates.length) setSelectedVendors(new Set());
    else setSelectedVendors(new Set(candidates.map((c: any) => c.vendor_id)));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relancer maintenant</DialogTitle>
          <DialogDescription>
            Sélectionnez un template et les vendeurs ciblés. Bypass des délais T+24h / T+72h.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Template</label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Choisir un template…" /></SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    Vague {t.wave_number} — {t.subject_fr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Vendeurs ({candidates.length})</label>
              <Button size="sm" variant="ghost" onClick={toggleAll}>
                {selectedVendors.size === candidates.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Aucun vendeur relançable.</p>
              ) : (
                candidates.map((c: any) => (
                  <label key={c.vendor_id} className="flex items-center gap-3 p-2 hover:bg-muted/40 cursor-pointer border-b last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selectedVendors.has(c.vendor_id)}
                      onChange={(e) => {
                        const next = new Set(selectedVendors);
                        if (e.target.checked) next.add(c.vendor_id);
                        else next.delete(c.vendor_id);
                        setSelectedVendors(next);
                      }}
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">{c.vendors?.company_name || c.vendors?.name || c.vendor_id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">{c.status}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}>
            {sendMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer ({selectedVendors.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Add Vendor Modal =====
function AddVendorModal({ rfqId, open, onClose }: { rfqId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"medikong" | "external">("medikong");

  // ---- MediKong vendor selection state ----
  const [vendorId, setVendorId] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [bypass, setBypass] = useState(false);

  // Eligible list (filtered server-side)
  const { data: eligible = [], isLoading: eligibleLoading } = useQuery({
    queryKey: ["admin-rfq-eligible-vendors", rfqId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rfq_admin_eligible_vendors_not_targeted" as never, { _rfq_id: rfqId } as never);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open && tab === "medikong" && !bypass,
  });

  // Full vendors list (used when bypass is on)
  const { data: allVendors = [], isLoading: allLoading } = useQuery({
    queryKey: ["admin-rfq-all-vendors", rfqId, filter],
    queryFn: async () => {
      let q = supabase
        .from("vendors")
        .select("id, name, company_name, country_code, kyc_status, accepts_rfq")
        .order("company_name", { ascending: true })
        .limit(200);
      if (filter.trim()) {
        const f = `%${filter.trim()}%`;
        q = q.or(`name.ilike.${f},company_name.ilike.${f}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open && tab === "medikong" && bypass,
  });

  const isLoading = bypass ? allLoading : eligibleLoading;
  const source = bypass ? allVendors : eligible;

  const filtered = useMemo(() => {
    const f = filter.toLowerCase().trim();
    if (!f) return source;
    return source.filter((v: any) =>
      (v.company_name || "").toLowerCase().includes(f) ||
      (v.name || "").toLowerCase().includes(f)
    );
  }, [source, filter]);

  const addMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("Sélectionnez un vendeur");
      const { data, error } = await supabase.rpc("rfq_admin_add_vendor" as never, {
        _rfq_id: rfqId,
        _vendor_id: vendorId,
        _bypass_eligibility: bypass,
      } as never);
      if (error) throw error;
      const result = data as any;

      if (result?.was_new) {
        try {
          const [{ data: vendor }, { data: dispatch }, { data: rfq }] = await Promise.all([
            supabase.from("vendors").select("name, contact_email").eq("id", vendorId).maybeSingle(),
            supabase.from("rfq_dispatch_log").select("tracking_token, reason").eq("rfq_id", rfqId).eq("vendor_id", vendorId).maybeSingle(),
            supabase.from("rfqs").select("quantity, target_price_excl_vat_cents, destination_country_code, responses_deadline, desired_delivery_date, payment_terms, required_offer_validity_days, comment, product_id, brand_id").eq("id", rfqId).maybeSingle(),
          ]);
          if (vendor?.contact_email && dispatch?.tracking_token && rfq) {
            const [productRes, brandRes] = await Promise.all([
              rfq.product_id ? supabase.from("products").select("name").eq("id", rfq.product_id).maybeSingle() : Promise.resolve({ data: null }),
              rfq.brand_id ? supabase.from("brands").select("name").eq("id", rfq.brand_id).maybeSingle() : Promise.resolve({ data: null }),
            ]);
            await supabase.functions.invoke("send-app-email", {
              body: {
                templateName: "rfq-vendor-invitation",
                recipientEmail: vendor.contact_email,
                idempotencyKey: `rfq-invite-${rfqId}-${vendorId}`,
                templateData: {
                  vendorName: vendor.name ?? "",
                  productName: (productRes as any)?.data?.name ?? null,
                  brandName: (brandRes as any)?.data?.name ?? null,
                  quantity: rfq.quantity,
                  targetPriceCents: rfq.target_price_excl_vat_cents,
                  countryCode: rfq.destination_country_code,
                  deadline: rfq.responses_deadline,
                  desiredDeliveryDate: rfq.desired_delivery_date,
                  paymentTerms: rfq.payment_terms,
                  offerValidityDays: rfq.required_offer_validity_days,
                  comment: rfq.comment,
                  targetReason: "manual",
                  targetReasonLabel: bypass
                    ? "Forcé par un administrateur (bypass éligibilité)"
                    : "Ajouté manuellement par un administrateur",
                  rfqUrl: `https://medikong-deal-finder.lovable.app/vendor/rfq/${rfqId}?t=${dispatch.tracking_token}`,
                },
              },
            });
          }
        } catch (e) {
          console.warn("manual add vendor email failed", e);
        }
      }
      return result;
    },
    onSuccess: (r: any) => {
      if (r?.was_new) toast.success(r?.bypassed ? "Vendeur forcé et notifié" : "Vendeur ajouté et notifié");
      else toast.info("Vendeur déjà ciblé");
      qc.invalidateQueries({ queryKey: ["rfq-dispatch-summary", rfqId] });
      qc.invalidateQueries({ queryKey: ["admin-rfq-eligible-vendors", rfqId] });
      qc.invalidateQueries({ queryKey: ["admin-rfq-all-vendors", rfqId] });
      qc.invalidateQueries({ queryKey: ["admin-rfq-list"] });
      onClose();
      setVendorId("");
      setBypass(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- External vendor invitation state ----
  const [extVendorId, setExtVendorId] = useState<string>("");
  const [extEmail, setExtEmail] = useState("");
  const [extName, setExtName] = useState("");

  const { data: extVendors = [], isLoading: extLoading } = useQuery({
    queryKey: ["admin-external-vendors-rfq-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_vendors")
        .select("id, name, contact_email, country_code, logo_url, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && tab === "external",
  });

  const onPickExtVendor = (id: string) => {
    setExtVendorId(id);
    const v = extVendors.find((x: any) => x.id === id);
    if (v) {
      if (!extEmail) setExtEmail(v.contact_email || "");
      if (!extName) setExtName(v.name || "");
    }
  };

  const inviteExtMut = useMutation({
    mutationFn: async () => {
      if (!extVendorId) throw new Error("Sélectionnez un vendeur externe");
      if (!extEmail.trim()) throw new Error("Email du contact requis");

      const { data, error } = await supabase.rpc("rfq_admin_invite_external_vendor" as never, {
        _rfq_id: rfqId,
        _external_vendor_id: extVendorId,
        _contact_email: extEmail.trim(),
        _contact_name: extName.trim() || null,
      } as never);
      if (error) throw error;
      const result = data as any;
      const token: string = result.token;
      const origin = typeof window !== "undefined" ? window.location.origin : "https://medikong.pro";
      const rfqUrl = `${origin}/rfq/externe/${token}`;

      // Best-effort email
      try {
        const [{ data: rfq }, { data: extVendor }] = await Promise.all([
          supabase.from("rfqs").select("quantity, target_price_excl_vat_cents, destination_country_code, responses_deadline, desired_delivery_date, payment_terms, required_offer_validity_days, comment, product_id, brand_id").eq("id", rfqId).maybeSingle(),
          supabase.from("external_vendors").select("name").eq("id", extVendorId).maybeSingle(),
        ]);
        if (rfq) {
          const [productRes, brandRes] = await Promise.all([
            rfq.product_id ? supabase.from("products").select("name").eq("id", rfq.product_id).maybeSingle() : Promise.resolve({ data: null }),
            rfq.brand_id ? supabase.from("brands").select("name").eq("id", rfq.brand_id).maybeSingle() : Promise.resolve({ data: null }),
          ]);
          await supabase.functions.invoke("send-app-email", {
            body: {
              templateName: "rfq-vendor-invitation",
              recipientEmail: extEmail.trim(),
              idempotencyKey: `rfq-ext-invite-${result.invitation_id}`,
              templateData: {
                vendorName: extName.trim() || (extVendor as any)?.name || "",
                productName: (productRes as any)?.data?.name ?? null,
                brandName: (brandRes as any)?.data?.name ?? null,
                quantity: rfq.quantity,
                targetPriceCents: rfq.target_price_excl_vat_cents,
                countryCode: rfq.destination_country_code,
                deadline: rfq.responses_deadline,
                desiredDeliveryDate: rfq.desired_delivery_date,
                paymentTerms: rfq.payment_terms,
                offerValidityDays: rfq.required_offer_validity_days,
                comment: rfq.comment,
                targetReason: "external",
                targetReasonLabel: "Invitation externe — encodage via lien sécurisé",
                rfqUrl,
              },
            },
          });
        }
      } catch (e) {
        console.warn("external invitation email failed", e);
      }
      return { ...result, rfqUrl };
    },
    onSuccess: (r: any) => {
      toast.success(r?.was_new ? "Invitation envoyée" : "Invitation mise à jour");
      // Copy link to clipboard for convenience
      if (r?.rfqUrl && typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(r.rfqUrl).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["rfq-dispatch-summary", rfqId] });
      onClose();
      setExtVendorId("");
      setExtEmail("");
      setExtName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter un vendeur à la RFQ</DialogTitle>
          <DialogDescription>
            Vendeur MediKong (avec ou sans bypass éligibilité) ou vendeur externe invité par email.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "medikong" | "external")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="medikong">Vendeur MediKong</TabsTrigger>
            <TabsTrigger value="external">Vendeur externe (email)</TabsTrigger>
          </TabsList>

          {/* === MediKong tab === */}
          <TabsContent value="medikong" className="space-y-3 mt-3">
            <label className="flex items-start gap-2 p-3 rounded-md border bg-amber-50 border-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={bypass}
                onChange={(e) => { setBypass(e.target.checked); setVendorId(""); }}
                className="mt-0.5"
              />
              <div className="text-sm">
                <div className="font-medium text-amber-900">Forcer l'ajout (bypass éligibilité)</div>
                <div className="text-xs text-amber-800">
                  Ignore tous les filtres serveur : KYC, devise, pays, stock/MOQ, capacité, opt-in. Tracé dans l'audit du routage.
                </div>
              </div>
            </label>

            <Input
              placeholder={bypass ? "Rechercher dans tous les vendeurs…" : "Filtrer par nom de société…"}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="border rounded-lg max-h-72 overflow-y-auto">
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  {bypass ? "Aucun vendeur trouvé." : "Aucun vendeur éligible non ciblé."}
                </p>
              ) : (
                filtered.map((v: any) => (
                  <label key={v.id ?? v.vendor_id} className="flex items-center gap-3 p-2 hover:bg-muted/40 cursor-pointer border-b last:border-b-0">
                    <input
                      type="radio"
                      name="vendor"
                      checked={vendorId === (v.id ?? v.vendor_id)}
                      onChange={() => setVendorId(v.id ?? v.vendor_id)}
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">{v.company_name || v.name || (v.id ?? v.vendor_id).slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.country_code ?? "—"}
                        {bypass && v.kyc_status && <> · KYC: <span className={v.kyc_status === "accepted" || v.kyc_status === "approved" ? "text-emerald-600" : "text-amber-600"}>{v.kyc_status}</span></>}
                        {bypass && v.accepts_rfq === false && <span className="text-amber-600"> · opt-out RFQ</span>}
                        {!bypass && v.match_reason && <> · {v.match_reason}</>}
                        {!bypass && v.score != null && ` · score ${Number(v.score).toFixed(2)}`}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={() => addMut.mutate()} disabled={addMut.isPending || !vendorId}>
                {addMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {bypass ? "Forcer l'ajout et notifier" : "Ajouter et notifier"}
              </Button>
            </div>
          </TabsContent>

          {/* === External vendor tab === */}
          <TabsContent value="external" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Envoie un email au contact avec un lien sécurisé vers une page web où il pourra encoder son devis sans créer de compte.
              Le lien expire dans 30 jours.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vendeur externe</label>
              <Select value={extVendorId} onValueChange={onPickExtVendor}>
                <SelectTrigger>
                  <SelectValue placeholder={extLoading ? "Chargement…" : "Sélectionner un vendeur externe"} />
                </SelectTrigger>
                <SelectContent>
                  {extVendors.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} {v.country_code ? `(${v.country_code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pas dans la liste ? <a href="/admin/vendeurs-externes" target="_blank" className="underline">Créer un vendeur externe</a>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Email du contact *</label>
                <Input
                  type="email"
                  value={extEmail}
                  onChange={(e) => setExtEmail(e.target.value)}
                  placeholder="contact@vendeur.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nom du contact</label>
                <Input
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  placeholder="Jean Dupont"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button
                onClick={() => inviteExtMut.mutate()}
                disabled={inviteExtMut.isPending || !extVendorId || !extEmail.trim()}
              >
                {inviteExtMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Inviter par email
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
