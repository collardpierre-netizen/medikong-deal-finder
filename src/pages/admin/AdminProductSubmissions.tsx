import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, CheckCircle2, XCircle, RefreshCw, GitMerge, MessageSquare,
  Search, Loader2, Inbox, AlertTriangle, ExternalLink,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatUpdatedAt, formatUpdatedAtFull } from "@/lib/format-date";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

type SubmissionStatus = "submitted" | "in_review" | "approved" | "rejected" | "needs_changes";

type Submission = {
  id: string;
  vendor_id: string;
  status: SubmissionStatus;
  proposed_payload: Record<string, any>;
  review_comment: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  resulting_product_id: string | null;
  resulting_brand_id: string | null;
  resulting_manufacturer_id: string | null;
  vendor?: { id: string; name?: string | null; company_name?: string | null; display_code?: string | null };
};

const STATUS_META: Record<SubmissionStatus, { label: string; tone: string }> = {
  submitted: { label: "À traiter", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  in_review: { label: "En cours", tone: "bg-blue-100 text-blue-800 border-blue-200" },
  approved: { label: "Validée", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Refusée", tone: "bg-rose-100 text-rose-800 border-rose-200" },
  needs_changes: { label: "À compléter", tone: "bg-orange-100 text-orange-800 border-orange-200" },
};

function payloadValue(p: Record<string, any>, ...keys: string[]): string | null {
  for (const k of keys) {
    const parts = k.split(".");
    let cur: any = p;
    for (const part of parts) {
      cur = cur?.[part];
      if (cur == null) break;
    }
    if (cur != null && cur !== "") return String(cur);
  }
  return null;
}

function SubmissionRow({
  submission,
  onOpen,
}: {
  submission: Submission;
  onOpen: (s: Submission) => void;
}) {
  const p = submission.proposed_payload ?? {};
  const productName = payloadValue(p, "product_name", "name", "product.name") ?? "Produit sans nom";
  const brand = payloadValue(p, "brand_name", "brand.name");
  const manufacturer = payloadValue(p, "manufacturer_name", "manufacturer.name");
  const cnk = payloadValue(p, "cnk_code", "cnk", "product.cnk");
  const gtin = payloadValue(p, "gtin", "ean", "product.gtin");
  const meta = STATUS_META[submission.status] ?? STATUS_META.submitted;
  const ageDays = Math.floor(
    (Date.now() - new Date(submission.created_at).getTime()) / 86_400_000
  );

  return (
    <button
      type="button"
      onClick={() => onOpen(submission)}
      className="w-full text-left border rounded-xl p-4 hover:border-primary/40 hover:bg-muted/30 transition flex items-start justify-between gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{productName}</p>
          <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>
            {meta.label}
          </Badge>
          {ageDays >= 3 && submission.status === "submitted" && (
            <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 gap-1">
              <AlertTriangle className="h-3 w-3" /> {ageDays}j
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {brand && <span>Marque : {brand}</span>}
          {manufacturer && <span>Fabricant : {manufacturer}</span>}
          {cnk && <span>CNK {cnk}</span>}
          {gtin && <span>GTIN {gtin}</span>}
          <span>
            Vendeur :{" "}
            {submission.vendor?.company_name ||
              submission.vendor?.name ||
              submission.vendor?.display_code ||
              "—"}
          </span>
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatUpdatedAt(submission.created_at)}
          </span>
        </TooltipTrigger>
        <TooltipContent>{formatUpdatedAtFull(submission.created_at)}</TooltipContent>
      </Tooltip>
    </button>
  );
}

function DuplicatesPanel({ submissionId, onMerge }: { submissionId: string; onMerge: (productId: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-submission-duplicates", submissionId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_find_submission_duplicates", {
        _submission_id: submissionId,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        product_id: string;
        product_name: string;
        product_slug: string;
        brand_name: string | null;
        manufacturer_name: string | null;
        match_reason: string;
        similarity: number;
        is_active: boolean;
      }>;
    },
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Recherche de doublons…
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-xs text-muted-foreground">Aucun doublon détecté.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div
          key={d.product_id}
          className="border rounded-lg p-3 flex items-center justify-between gap-3 bg-muted/30"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{d.product_name}</p>
              <Badge variant="outline" className="text-[10px]">
                {d.match_reason} · {Math.round(d.similarity * 100)}%
              </Badge>
              {!d.is_active && (
                <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                  Inactif
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {[d.brand_name, d.manufacturer_name].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/admin/produits/${d.product_id}`, "_blank")}
              className="gap-1"
            >
              <ExternalLink className="h-3 w-3" /> Voir
            </Button>
            <Button size="sm" onClick={() => onMerge(d.product_id)} className="gap-1">
              <GitMerge className="h-3 w-3" /> Fusionner ici
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewSheet({
  submission,
  onClose,
}: {
  submission: Submission | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async (args: {
      decision: "approve" | "reject" | "needs_changes" | "merge";
      mergeIntoProductId?: string;
    }) => {
      const { data, error } = await supabase.rpc("admin_review_product_submission", {
        _submission_id: submission!.id,
        _decision: args.decision,
        _comment: comment || null,
        _merge_into_product_id: args.mergeIntoProductId ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      const labels = {
        approve: "Soumission validée. Vendeur notifié.",
        reject: "Soumission refusée. Vendeur notifié.",
        needs_changes: "Demande de modifications envoyée.",
        merge: "Fusion effectuée. Offres réorientées.",
      };
      toast.success(labels[vars.decision]);
      qc.invalidateQueries({ queryKey: ["admin-product-submissions"] });
      onClose();
      setComment("");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erreur lors de la validation"),
  });

  if (!submission) return null;
  const p = submission.proposed_payload ?? {};
  const productName = payloadValue(p, "product_name", "name", "product.name") ?? "Produit sans nom";

  return (
    <Sheet open={!!submission} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {productName}
            <Badge variant="outline" className={STATUS_META[submission.status].tone}>
              {STATUS_META[submission.status].label}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            Proposée le {formatUpdatedAt(submission.created_at)} par{" "}
            {submission.vendor?.company_name || submission.vendor?.name || "—"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Payload */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Données proposées</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {Object.entries(p).map(([k, v]) => (
                <div key={k} className="border rounded p-2 bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k}</p>
                  <p className="font-mono break-all whitespace-pre-wrap">
                    {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v ?? "—")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Doublons */}
          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Search className="h-4 w-4" /> Doublons potentiels
            </h3>
            <DuplicatesPanel
              submissionId={submission.id}
              onMerge={(pid) => reviewMutation.mutate({ decision: "merge", mergeIntoProductId: pid })}
            />
          </section>

          {/* Commentaire */}
          <section>
            <label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4" /> Commentaire (visible par le vendeur)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Motif du refus, précisions à demander, etc."
            />
          </section>

          {/* Actions */}
          <section className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              onClick={() => reviewMutation.mutate({ decision: "approve" })}
              disabled={reviewMutation.isPending}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" /> Approuver
            </Button>
            <Button
              variant="outline"
              onClick={() => reviewMutation.mutate({ decision: "needs_changes" })}
              disabled={reviewMutation.isPending || !comment}
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" /> Demander des modifs
            </Button>
            <Button
              variant="destructive"
              onClick={() => reviewMutation.mutate({ decision: "reject" })}
              disabled={reviewMutation.isPending || !comment}
              className="gap-1"
            >
              <XCircle className="h-4 w-4" /> Refuser
            </Button>
            {reviewMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin self-center" />
            )}
          </section>
          <p className="text-[11px] text-muted-foreground">
            Le commentaire est obligatoire pour refuser ou demander des modifications.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminProductSubmissions() {
  const [tab, setTab] = useState<SubmissionStatus | "all">("submitted");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["admin-product-submissions", tab],
    queryFn: async () => {
      let q = supabase
        .from("product_submissions")
        .select(
          "id, vendor_id, status, proposed_payload, review_comment, reviewed_at, reviewed_by, created_at, updated_at, resulting_product_id, resulting_brand_id, resulting_manufacturer_id, vendor:vendors!product_submissions_vendor_id_fkey(id, name, company_name, display_code)"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (tab !== "all") q = q.eq("status", tab);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Submission[];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["admin-product-submissions-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_submissions")
        .select("status")
        .limit(2000);
      if (error) throw error;
      const acc: Record<string, number> = { submitted: 0, in_review: 0, needs_changes: 0, approved: 0, rejected: 0 };
      for (const r of data ?? []) acc[(r as any).status] = (acc[(r as any).status] ?? 0) + 1;
      return acc;
    },
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return submissions;
    return submissions.filter((s) => {
      const p = s.proposed_payload ?? {};
      const hay = [
        payloadValue(p, "product_name", "name", "product.name"),
        payloadValue(p, "brand_name", "brand.name"),
        payloadValue(p, "manufacturer_name", "manufacturer.name"),
        payloadValue(p, "cnk_code", "cnk", "product.cnk"),
        payloadValue(p, "gtin", "ean", "product.gtin"),
        s.vendor?.company_name,
        s.vendor?.name,
        s.vendor?.display_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [submissions, search]);

  return (
    <TooltipProvider>
      <div className="container max-w-6xl py-6 space-y-5">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Produits soumis</h1>
            <p className="text-sm text-muted-foreground mt-1">
              File de validation des produits proposés par les vendeurs. Approuver publie immédiatement la
              référence dans le catalogue MediKong et notifie le vendeur soumissionnaire ainsi que les
              vendeurs intéressés.
            </p>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">File des soumissions</CardTitle>
              <div className="relative w-72 max-w-full">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Nom, CNK, GTIN, vendeur…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="submitted" className="gap-2">
                  <Clock className="h-3 w-3" /> À traiter
                  {counts?.submitted ? (
                    <Badge variant="secondary" className="ml-1">{counts.submitted}</Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="in_review" className="gap-2">
                  En cours
                  {counts?.in_review ? (
                    <Badge variant="secondary" className="ml-1">{counts.in_review}</Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="needs_changes">À compléter</TabsTrigger>
                <TabsTrigger value="approved">Validées</TabsTrigger>
                <TabsTrigger value="rejected">Refusées</TabsTrigger>
                <TabsTrigger value="all">Toutes</TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-4">
                {isLoading ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Chargement…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Inbox className="h-8 w-8 mx-auto mb-2 opacity-60" />
                    <p className="text-sm">Aucune soumission dans cette vue.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((s) => (
                      <SubmissionRow key={s.id} submission={s} onOpen={setSelected} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <ReviewSheet submission={selected} onClose={() => setSelected(null)} />
      </div>
    </TooltipProvider>
  );
}
