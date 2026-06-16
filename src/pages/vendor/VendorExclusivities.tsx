import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Sparkles, EyeOff, Lock, Info, Mail, Loader2 } from "lucide-react";

/**
 * Espace Vendeur — lecture seule des exclusivités contractuelles.
 *
 * Source : public.vendor_exclusivities (RLS : "Vendor reads own exclusivities").
 * Écriture admin-only — le vendeur passe par MediKong pour créer/modifier
 * une règle (lien mailto vers contracts@medikong.pro).
 *
 * Voir mem://features/vendor-exclusivities pour le moteur DB (triggers,
 * cron d'expiration, modes showcase/hide/block).
 */

type Scope = "brand" | "manufacturer" | "product" | "category";
type Mode = "showcase" | "hide" | "block";

interface ExclusivityRow {
  id: string;
  vendor_id: string;
  scope: Scope;
  brand_id: string | null;
  manufacturer_id: string | null;
  product_id: string | null;
  category_id: string | null;
  mode: Mode;
  valid_from: string;
  valid_until: string;
  country_codes: string[] | null;
  reason: string | null;
  contract_ref: string | null;
  is_active: boolean;
  created_at: string;
}

const SCOPE_META: Record<Scope, { label: string; table: "brands" | "manufacturers" | "products" | "categories" }> = {
  brand: { label: "Marque", table: "brands" },
  manufacturer: { label: "Fabricant", table: "manufacturers" },
  product: { label: "Produit", table: "products" },
  category: { label: "Catégorie", table: "categories" },
};

const MODE_META: Record<Mode, {
  label: string;
  variant: "default" | "secondary" | "destructive";
  icon: typeof Sparkles;
  vendorHint: string;
}> = {
  showcase: {
    label: "Mise en avant",
    variant: "default",
    icon: Sparkles,
    vendorHint:
      "Vos offres sur ce scope sont mises en avant côté acheteur (badge / pictogramme). Les offres concurrentes restent visibles.",
  },
  hide: {
    label: "Masquer concurrents",
    variant: "secondary",
    icon: EyeOff,
    vendorHint:
      "Seules vos offres sont visibles côté acheteur sur ce scope pendant la période. Les offres concurrentes existantes sont masquées.",
  },
  block: {
    label: "Bloquer concurrents",
    variant: "destructive",
    icon: Lock,
    vendorHint:
      "Aucun autre vendeur ne peut créer ou activer une offre sur ce scope pendant la période (contrôle DB).",
  },
};

type StatusFilter = "active" | "future" | "expired";

export default function VendorExclusivities() {
  const { data: vendor, isLoading: vendorLoading } = useCurrentVendor();
  const [tab, setTab] = useState<StatusFilter>("active");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor-exclusivities", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_exclusivities" as any)
        .select(
          "id, vendor_id, scope, brand_id, manufacturer_id, product_id, category_id, mode, valid_from, valid_until, country_codes, reason, contract_ref, is_active, created_at",
        )
        .eq("vendor_id", vendor!.id)
        .order("valid_until", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ExclusivityRow[];
    },
  });

  // Résolution libellés cibles
  const targetIdsByScope = useMemo(() => {
    const map: Record<Scope, Set<string>> = {
      brand: new Set(),
      manufacturer: new Set(),
      product: new Set(),
      category: new Set(),
    };
    rows.forEach((r) => {
      const id = r.brand_id || r.manufacturer_id || r.product_id || r.category_id;
      if (id) map[r.scope].add(id);
    });
    return map;
  }, [rows]);

  const { data: targetLabels = new Map<string, string>() } = useQuery({
    queryKey: [
      "vendor-exclusivities-targets",
      Array.from(targetIdsByScope.brand),
      Array.from(targetIdsByScope.manufacturer),
      Array.from(targetIdsByScope.product),
      Array.from(targetIdsByScope.category),
    ],
    enabled: rows.length > 0,
    queryFn: async () => {
      const map = new Map<string, string>();
      const tasks: Promise<any>[] = [];
      (Object.keys(SCOPE_META) as Scope[]).forEach((scope) => {
        const ids = Array.from(targetIdsByScope[scope]);
        if (ids.length === 0) return;
        tasks.push(
          supabase.from(SCOPE_META[scope].table).select("id, name").in("id", ids),
        );
      });
      const results = await Promise.all(tasks);
      results.forEach((res: any) => {
        (res.data || []).forEach((row: any) => map.set(row.id, row.name || row.id));
      });
      return map;
    },
  });

  const now = Date.now();
  const buckets = useMemo(() => {
    const active: ExclusivityRow[] = [];
    const future: ExclusivityRow[] = [];
    const expired: ExclusivityRow[] = [];
    rows.forEach((r) => {
      const from = new Date(r.valid_from).getTime();
      const until = new Date(r.valid_until).getTime();
      if (until <= now) expired.push(r);
      else if (from > now) future.push(r);
      else if (r.is_active) active.push(r);
      else expired.push(r);
    });
    return { active, future, expired };
  }, [rows, now]);

  const current = buckets[tab];

  if (vendorLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!vendor?.id) {
    return (
      <div className="p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Compte vendeur requis</AlertTitle>
          <AlertDescription>Connectez-vous à votre compte vendeur pour consulter vos exclusivités.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const mailSubject = encodeURIComponent(
    `[Exclusivité] Demande — ${vendor.company_name || vendor.name || vendor.display_code || "vendeur"}`,
  );
  const mailBody = encodeURIComponent(
    [
      "Bonjour,",
      "",
      "Nous souhaitons mettre en place une exclusivité MediKong avec les paramètres suivants :",
      "",
      "- Scope (marque / fabricant / produit / catégorie) :",
      "- Cible (nom + référence) :",
      "- Mode souhaité (mise en avant / masquage / blocage) :",
      "- Pays concernés :",
      "- Période souhaitée (du … au …) :",
      "- Référence contrat / motif :",
      "",
      "Merci.",
    ].join("\n"),
  );

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <Helmet><title>Exclusivités — Espace Vendeur MediKong</title></Helmet>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#1D2530]">
            <ShieldCheck className="h-6 w-6 text-primary" /> Mes exclusivités
          </h1>
          <p className="text-sm text-[#616B7C] mt-1 max-w-2xl">
            Règles contractuelles de mise en avant, masquage ou blocage de la concurrence
            sur une marque, un fabricant, un produit ou une catégorie, sur une période donnée.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={`mailto:contracts@medikong.pro?subject=${mailSubject}&body=${mailBody}`}>
            <Mail className="h-4 w-4 mr-2" /> Demander une exclusivité
          </a>
        </Button>
      </header>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Lecture seule</AlertTitle>
        <AlertDescription className="text-xs">
          Les exclusivités sont liées à un contrat MediKong et gérées par notre équipe.
          Pour créer, modifier, prolonger ou clôturer une règle, contactez-nous.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Actives" value={buckets.active.length} highlight />
        <KpiCard label="À venir" value={buckets.future.length} />
        <KpiCard label="Expirées" value={buckets.expired.length} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Détails</CardTitle>
          <CardDescription>
            Modes possibles :{" "}
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> mise en avant</span> ·{" "}
            <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3" /> masquer concurrents</span> ·{" "}
            <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> bloquer concurrents</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="active">Actives ({buckets.active.length})</TabsTrigger>
              <TabsTrigger value="future">À venir ({buckets.future.length})</TabsTrigger>
              <TabsTrigger value="expired">Expirées ({buckets.expired.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4">
              {isLoading ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Chargement…
                </div>
              ) : current.length === 0 ? (
                <EmptyState tab={tab} />
              ) : (
                <div className="space-y-3">
                  {current.map((r) => (
                    <ExclusivityCard
                      key={r.id}
                      row={r}
                      targetLabel={
                        targetLabels.get(
                          r.brand_id || r.manufacturer_id || r.product_id || r.category_id || "",
                        ) || "—"
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function ExclusivityCard({ row, targetLabel }: { row: ExclusivityRow; targetLabel: string }) {
  const mode = MODE_META[row.mode];
  const Icon = mode.icon;
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={mode.variant} className="gap-1">
              <Icon className="h-3 w-3" /> {mode.label}
            </Badge>
            <Badge variant="outline">{SCOPE_META[row.scope].label}</Badge>
            <span className="font-medium text-[#1D2530] truncate">{targetLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{mode.vendorHint}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
        <Meta label="Du">{new Date(row.valid_from).toLocaleDateString("fr-FR")}</Meta>
        <Meta label="Au">{new Date(row.valid_until).toLocaleDateString("fr-FR")}</Meta>
        <Meta label="Pays">
          {row.country_codes && row.country_codes.length > 0
            ? row.country_codes.join(", ")
            : <span className="text-muted-foreground">Tous</span>}
        </Meta>
        <Meta label="Référence contrat">
          {row.contract_ref || <span className="text-muted-foreground">—</span>}
        </Meta>
      </div>

      {row.reason && (
        <p className="mt-3 text-xs text-muted-foreground border-t pt-2">
          <span className="font-medium text-foreground">Motif :</span> {row.reason}
        </p>
      )}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function EmptyState({ tab }: { tab: StatusFilter }) {
  const msg = {
    active: "Aucune exclusivité active pour le moment.",
    future: "Aucune exclusivité programmée.",
    expired: "Aucune exclusivité expirée.",
  }[tab];
  return (
    <div className="py-12 text-center">
      <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{msg}</p>
      {tab === "active" && (
        <p className="text-xs text-muted-foreground mt-2">
          Une exclusivité se met en place via contrat avec MediKong.
        </p>
      )}
    </div>
  );
}
