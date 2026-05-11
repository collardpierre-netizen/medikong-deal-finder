import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, XCircle, CreditCard, Pause, Inbox, Users, TrendingUp, Phone, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";

type Overview = {
  subscription_id: string;
  buyer_id: string;
  status: string;
  plan_id: string;
  plan_label: string;
  volume_threshold_ht: number;
  trial_volume_ht: number;
  lifetime_volume_ht: number;
  current_phase: string;
  current_free_ends_at: string | null;
  free_days_remaining: number | null;
  threshold_progress_pct: number | null;
  has_active_extension_request: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  bonus_started_at: string | null;
  bonus_ends_at: string | null;
  extension_started_at: string | null;
  extension_ends_at: string | null;
  paid_started_at: string | null;
  created_at: string;
};

type ExtRequest = {
  id: string;
  subscription_id: string;
  buyer_id: string;
  status: string;
  reason: string | null;
  callback_window: string | null;
  contact_attempt_count: number | null;
  last_contact_at: string | null;
  contact_notes: string | null;
  granted_months: number | null;
  rejection_reason: string | null;
  created_at: string;
  resolved_at: string | null;
};

const PHASE_BADGE: Record<string, { label: string; tone: "default" | "secondary" | "outline" | "destructive" }> = {
  trial: { label: "Essai", tone: "default" },
  bonus_free: { label: "Bonus", tone: "secondary" },
  extension: { label: "Extension", tone: "secondary" },
  paid: { label: "Payant", tone: "outline" },
  pending_decision: { label: "Décision attendue", tone: "destructive" },
  cancelled: { label: "Annulé", tone: "destructive" },
};

const REQ_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "default",
  contacted: "secondary",
  approved: "default",
  rejected: "destructive",
  expired: "destructive",
};

const fmtEUR = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n ?? 0));
const fmtDate = (iso: string | null | undefined) => (iso ? formatUpdatedAt(iso) : "—");

type SortKey =
  | "created_at"
  | "trial_volume_ht"
  | "lifetime_volume_ht"
  | "threshold_progress_pct"
  | "current_free_ends_at"
  | "current_phase";

const SORT_LABELS: Record<SortKey, string> = {
  created_at: "Date de création",
  trial_volume_ht: "Volume essai",
  lifetime_volume_ht: "Volume cumulé",
  threshold_progress_pct: "Progression seuil",
  current_free_ends_at: "Fin de phase",
  current_phase: "Phase",
};

// Sanitize for PostgREST ilike/or() — strip commas, parens, % and quotes
const sanitizeForOr = (s: string) => s.replace(/[(),"%]/g, " ").trim();

export default function AdminAbonnementsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [grantOpen, setGrantOpen] = useState<ExtRequest | null>(null);
  const [grantMonths, setGrantMonths] = useState(3);
  const [grantNotes, setGrantNotes] = useState("");
  const [grantContactNotes, setGrantContactNotes] = useState("");
  const [rejectOpen, setRejectOpen] = useState<ExtRequest | null>(null);
  const [rejectReasonPreset, setRejectReasonPreset] = useState<string>("volume_insuffisant");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectContactNotes, setRejectContactNotes] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter/sort/search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, phaseFilter, sortBy, sortDir, pageSize]);

  // Pre-resolve buyer_ids matching search (company / full_name)
  const { data: searchBuyerIds } = useQuery({
    queryKey: ["admin-subs-search", debouncedSearch],
    enabled: debouncedSearch.length > 0,
    queryFn: async () => {
      const q = sanitizeForOr(debouncedSearch);
      if (!q) return [] as string[];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id")
        .or(`company_name.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((p: any) => p.user_id as string);
    },
  });

  // Server-side paginated overview
  const { data: pageResult, isLoading: loadingOverview, isFetching: fetchingOverview } = useQuery({
    queryKey: [
      "admin-subs-overview",
      { phaseFilter, sortBy, sortDir, page, pageSize, search: debouncedSearch, ids: searchBuyerIds?.length ?? null },
    ],
    enabled: !debouncedSearch || searchBuyerIds !== undefined,
    queryFn: async () => {
      // If user is searching but no profile matches, short-circuit
      if (debouncedSearch && (searchBuyerIds?.length ?? 0) === 0) {
        return { rows: [] as Overview[], count: 0 };
      }
      let query = supabase
        .from("v_buyer_subscription_overview")
        .select("*", { count: "exact" });

      if (phaseFilter !== "all") query = query.eq("current_phase", phaseFilter);
      if (debouncedSearch && searchBuyerIds && searchBuyerIds.length > 0) {
        query = query.in("buyer_id", searchBuyerIds);
      }

      query = query.order(sortBy, { ascending: sortDir === "asc", nullsFirst: false });

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as Overview[], count: count ?? 0 };
    },
  });

  const overviews = pageResult?.rows ?? [];
  const totalCount = pageResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Profiles join (only for current page)
  const buyerIds = useMemo(() => Array.from(new Set(overviews.map((o) => o.buyer_id))), [overviews]);
  const { data: profiles } = useQuery({
    queryKey: ["admin-subs-profiles", buyerIds.sort().join(",")],
    enabled: buyerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, company_name, country")
        .in("user_id", buyerIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, { full_name: string | null; company_name: string | null; country: string | null }>();
    (profiles ?? []).forEach((p: any) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  // KPIs computed server-side via head:true counts (independent of pagination)
  const { data: kpiCounts } = useQuery({
    queryKey: ["admin-subs-kpis"],
    queryFn: async () => {
      const headCount = (phase: string | null) => {
        let q = supabase
          .from("v_buyer_subscription_overview")
          .select("subscription_id", { count: "exact", head: true });
        if (phase) q = q.eq("current_phase", phase);
        return q;
      };
      const [allRes, trialRes, bonusRes, extRes, paidRes] = await Promise.all([
        headCount(null),
        headCount("trial"),
        headCount("bonus_free"),
        headCount("extension"),
        headCount("paid"),
      ]);
      return {
        total: allRes.count ?? 0,
        trial: trialRes.count ?? 0,
        bonus: (bonusRes.count ?? 0) + (extRes.count ?? 0),
        paid: paidRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  // Pending extension requests
  const { data: requests, isLoading: loadingReq } = useQuery({
    queryKey: ["admin-extension-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_extension_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ExtRequest[];
    },
  });

  // Mutations
  const grantMut = useMutation({
    mutationFn: async () => {
      if (!grantOpen) return;
      const { error } = await supabase.rpc("grant_subscription_extension", {
        _req_id: grantOpen.id,
        _months: grantMonths,
        _notes: grantNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Extension accordée");
      setGrantOpen(null);
      setGrantNotes("");
      qc.invalidateQueries({ queryKey: ["admin-extension-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-subs-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec"),
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      if (!rejectOpen) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("subscription_extension_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectReason || null,
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: u?.user?.id ?? null,
        })
        .eq("id", rejectOpen.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande refusée");
      setRejectOpen(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-extension-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec"),
  });

  const markContactedMut = useMutation({
    mutationFn: async (req: ExtRequest) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("subscription_extension_requests")
        .update({
          status: "contacted",
          contact_attempt_count: (req.contact_attempt_count ?? 0) + 1,
          last_contact_at: new Date().toISOString(),
          assigned_to_user_id: u?.user?.id ?? null,
        })
        .eq("id", req.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact enregistré");
      qc.invalidateQueries({ queryKey: ["admin-extension-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec"),
  });

  const switchPaidMut = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase.rpc("force_switch_to_paid", { _sub_id: subId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bascule payant effectuée");
      qc.invalidateQueries({ queryKey: ["admin-subs-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec"),
  });

  const pauseMut = useMutation({
    mutationFn: async (subId: string) => {
      const reason = window.prompt("Motif de la pause (optionnel) :") ?? null;
      const { error } = await supabase.rpc("pause_subscription", { _sub_id: subId, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Abonnement mis en pause");
      qc.invalidateQueries({ queryKey: ["admin-subs-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec"),
  });

  // KPIs (server-side counts + pending requests count from local list)
  const kpis = useMemo(
    () => ({
      total: kpiCounts?.total ?? 0,
      trial: kpiCounts?.trial ?? 0,
      bonus: kpiCounts?.bonus ?? 0,
      paid: kpiCounts?.paid ?? 0,
      pending: (requests ?? []).filter((r) => r.status === "pending" || r.status === "contacted").length,
    }),
    [kpiCounts, requests]
  );

  const pendingRequests = useMemo(
    () => (requests ?? []).filter((r) => r.status === "pending" || r.status === "contacted"),
    [requests]
  );
  const resolvedRequests = useMemo(
    () => (requests ?? []).filter((r) => !["pending", "contacted"].includes(r.status)),
    [requests]
  );

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const SortHeader = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => {
    const active = sortBy === k;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
        >
          {children}
          <Icon className={`w-3 h-3 ${active ? "text-foreground" : "text-muted-foreground/60"}`} />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <Helmet>
        <title>Abonnements pharmaciens — Admin MediKong</title>
      </Helmet>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Abonnements pharmaciens</h1>
        <p className="text-sm text-muted-foreground">
          Suivi des abonnements buyer, progression de volume et traitement des demandes d'extension.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi icon={Users} label="Total" value={kpis.total} />
        <Kpi icon={CheckCircle2} label="En essai" value={kpis.trial} tone="default" />
        <Kpi icon={TrendingUp} label="Bonus / extension" value={kpis.bonus} tone="secondary" />
        <Kpi icon={CreditCard} label="Payant" value={kpis.paid} tone="outline" />
        <Kpi icon={Inbox} label="Demandes en attente" value={kpis.pending} tone="destructive" />
      </div>

      <Tabs defaultValue="subs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subs">Abonnements ({totalCount})</TabsTrigger>
          <TabsTrigger value="pending">
            Demandes en attente ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="resolved">Demandes traitées ({resolvedRequests.length})</TabsTrigger>
        </TabsList>

        {/* SUBS LIST */}
        <TabsContent value="subs">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <CardTitle className="text-base">Portefeuille abonnements</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-8 w-64"
                      placeholder="Rechercher pharmacie ou ID…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les phases</SelectItem>
                      <SelectItem value="trial">Essai</SelectItem>
                      <SelectItem value="bonus_free">Bonus gratuit</SelectItem>
                      <SelectItem value="extension">Extension</SelectItem>
                      <SelectItem value="paid">Payant</SelectItem>
                      <SelectItem value="pending_decision">Décision attendue</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Trier par…" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                        <SelectItem key={k} value={k}>Trier : {SORT_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    title={sortDir === "asc" ? "Croissant" : "Décroissant"}
                  >
                    {sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pharmacie</TableHead>
                          <SortHeader k="current_phase">Phase</SortHeader>
                          <SortHeader k="threshold_progress_pct">Progression volume</SortHeader>
                          <SortHeader k="current_free_ends_at">Phase actuelle se termine</SortHeader>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overviews.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun abonnement</TableCell></TableRow>
                        ) : overviews.map((o) => {
                          const p = profileMap.get(o.buyer_id);
                          const phase = PHASE_BADGE[o.current_phase] ?? PHASE_BADGE.trial;
                          const pct = Math.max(0, Math.min(100, o.threshold_progress_pct ?? 0));
                          return (
                            <TableRow key={o.subscription_id}>
                              <TableCell>
                                <div className="font-medium">{p?.company_name ?? p?.full_name ?? "—"}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p?.country ?? "—"} · <span className="font-mono">{o.buyer_id.slice(0, 8)}</span>
                                  {o.has_active_extension_request && (
                                    <Badge variant="destructive" className="ml-2">Demande en cours</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={phase.tone}>{phase.label}</Badge>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {o.status}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[200px]">
                                <Progress value={pct} className="h-2 mb-1" />
                                <div className="text-xs text-muted-foreground">
                                  {fmtEUR(o.trial_volume_ht)} / {fmtEUR(o.volume_threshold_ht)} ({pct}%)
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Cumul : {fmtEUR(o.lifetime_volume_ht)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{fmtDate(o.current_free_ends_at)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {o.free_days_remaining != null ? `${o.free_days_remaining} j restants` : "—"}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex flex-col gap-1">
                                  {o.current_phase !== "paid" && (
                                    <Button size="sm" variant="outline" onClick={() => switchPaidMut.mutate(o.subscription_id)} disabled={switchPaidMut.isPending}>
                                      <CreditCard className="w-3 h-3 mr-1" /> Bascule payant
                                    </Button>
                                  )}
                                  {o.status !== "paused" && o.status !== "cancelled" && (
                                    <Button size="sm" variant="ghost" onClick={() => pauseMut.mutate(o.subscription_id)} disabled={pauseMut.isPending}>
                                      <Pause className="w-3 h-3 mr-1" /> Pause
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {fetchingOverview && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>
                        {totalCount === 0
                          ? "0 résultat"
                          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} sur ${totalCount.toLocaleString("fr-BE")}`}
                      </span>
                      <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v, 10))}>
                        <SelectTrigger className="h-8 w-[110px] ml-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[25, 50, 100, 200].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || fetchingOverview}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm px-2 tabular-nums">
                        Page {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || fetchingOverview}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PENDING REQUESTS */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Demandes d'extension à traiter</CardTitle>
              <CardDescription>
                Les demandes <strong>pending</strong> doivent être contactées puis approuvées (ou refusées).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReq ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
              ) : pendingRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm py-6 text-center">Aucune demande en attente 🎉</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((r) => {
                    const p = profileMap.get(r.buyer_id);
                    return (
                      <div key={r.id} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{p?.company_name ?? p?.full_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              Reçue {fmtDate(r.created_at)} · <Badge variant={REQ_BADGE[r.status]}>{r.status}</Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => markContactedMut.mutate(r)} disabled={markContactedMut.isPending}>
                              <Phone className="w-3 h-3 mr-1" /> Contact effectué
                            </Button>
                            <Button size="sm" onClick={() => { setGrantOpen(r); setGrantMonths(3); setGrantNotes(""); }}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Accorder
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setRejectOpen(r); setRejectReason(""); }}>
                              <XCircle className="w-3 h-3 mr-1" /> Refuser
                            </Button>
                          </div>
                        </div>
                        {r.reason && <p className="text-sm mt-2"><span className="text-muted-foreground">Motif :</span> {r.reason}</p>}
                        {r.callback_window && <p className="text-xs text-muted-foreground mt-1">Créneau de rappel : {r.callback_window}</p>}
                        <div className="text-xs text-muted-foreground mt-2">
                          Tentatives : {r.contact_attempt_count ?? 0}
                          {r.last_contact_at ? ` · Dernier contact ${fmtDate(r.last_contact_at)}` : ""}
                        </div>
                        {r.contact_notes && <p className="text-xs italic mt-1">{r.contact_notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RESOLVED */}
        <TabsContent value="resolved">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique</CardTitle>
            </CardHeader>
            <CardContent>
              {resolvedRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm py-6 text-center">Aucune demande traitée</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pharmacie</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Mois</TableHead>
                      <TableHead>Motif refus</TableHead>
                      <TableHead>Résolu le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedRequests.map((r) => {
                      const p = profileMap.get(r.buyer_id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{p?.company_name ?? p?.full_name ?? r.buyer_id.slice(0, 8)}</TableCell>
                          <TableCell><Badge variant={REQ_BADGE[r.status]}>{r.status}</Badge></TableCell>
                          <TableCell>{r.granted_months ?? "—"}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.rejection_reason ?? "—"}</TableCell>
                          <TableCell>{fmtDate(r.resolved_at)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* GRANT DIALOG */}
      <Dialog open={!!grantOpen} onOpenChange={(open) => !open && setGrantOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accorder une extension</DialogTitle>
            <DialogDescription>
              La phase gratuite sera prolongée du nombre de mois choisi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="months">Nombre de mois</Label>
              <Input id="months" type="number" min={1} max={24} value={grantMonths} onChange={(e) => setGrantMonths(parseInt(e.target.value || "3", 10))} />
            </div>
            <div>
              <Label htmlFor="notes">Notes internes (optionnel)</Label>
              <Textarea id="notes" rows={3} value={grantNotes} onChange={(e) => setGrantNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(null)}>Annuler</Button>
            <Button onClick={() => grantMut.mutate()} disabled={grantMut.isPending || grantMonths < 1}>
              {grantMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer l'extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={!!rejectOpen} onOpenChange={(open) => !open && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
            <DialogDescription>Le pharmacien verra le motif de refus dans son espace.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reject-reason">Motif</Label>
            <Textarea id="reject-reason" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex : volume trop éloigné du seuil, déjà bénéficié d'une extension…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
              {rejectMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: {
  icon: typeof Users; label: string; value: number;
  tone?: "default" | "secondary" | "outline" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="w-3.5 h-3.5" /> {label}
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
