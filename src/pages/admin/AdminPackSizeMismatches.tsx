import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Loader2, Search, AlertTriangle, Check, Wrench, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Mismatch {
  id: string;
  name: string;
  gtin: string | null;
  db_pack_size: number;
  regex_pack_size: number | null;
  gtin_twin_pack_size: number | null;
  suggested: number;
  reason: string;
  source: string | null;
  is_active: boolean;
}

interface ScanResult {
  ok: boolean;
  scanned: number;
  mismatches: Mismatch[];
  nextCursor: string | null;
  done: boolean;
}

export default function AdminPackSizeMismatches() {
  const [scanLimit, setScanLimit] = useState(1000);
  const [items, setItems] = useState<Mismatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [scanned, setScanned] = useState(0);

  const scan = useMutation({
    mutationFn: async (reset: boolean) => {
      const { data, error } = await supabase.functions.invoke("check-pack-size-mismatches", {
        body: { action: "scan", scanLimit, cursor: reset ? null : cursor, onlyMismatches: true },
      });
      if (error) throw error;
      return data as ScanResult;
    },
    onSuccess: (data, reset) => {
      setItems(prev => reset ? data.mismatches : [...prev, ...data.mismatches]);
      setCursor(data.nextCursor);
      setDone(data.done);
      setScanned(prev => reset ? data.scanned : prev + data.scanned);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validate = useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await supabase.functions.invoke("check-pack-size-mismatches", {
        body: { action: "validate", productId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, productId) => {
      setItems(prev => prev.filter(i => i.id !== productId));
      toast.success("Marqué comme validé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: async ({ productId, newPackSize }: { productId: string; newPackSize: number }) => {
      const { data, error } = await supabase.functions.invoke("check-pack-size-mismatches", {
        body: { action: "apply", productId, newPackSize },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      setItems(prev => prev.filter(i => i.id !== vars.productId));
      toast.success(`Pack_size corrigé à ${vars.newPackSize}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Helmet>
        <title>Cohérence pack_size — MediKong Admin</title>
      </Helmet>

      <div className="flex items-center gap-3">
        <AlertTriangle className="w-7 h-7 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold">Vérification cohérence pack_size</h1>
          <p className="text-sm text-muted-foreground">
            Compare le conditionnement enregistré en base avec ce que le libellé suggère
            (regex) ou avec un produit jumeau (même GTIN).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Lancer un scan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <Label htmlFor="lim">Produits par batch</Label>
              <Input
                id="lim" type="number" min={100} max={5000}
                value={scanLimit}
                onChange={e => setScanLimit(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setItems([]); setCursor(null); setDone(false); setScanned(0); scan.mutate(true); }}
              disabled={scan.isPending}
            >
              {scan.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Nouveau scan
            </Button>
            <Button
              onClick={() => scan.mutate(false)}
              disabled={scan.isPending || done || !cursor}
            >
              Continuer (batch suivant)
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {scanned > 0 && (
              <>Scannés : <strong>{scanned.toLocaleString("fr-FR")}</strong> · Incohérences trouvées : <strong>{items.length}</strong>{done && " · ✅ scan terminé"}</>
            )}
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Incohérences ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(m => (
              <div key={m.id} className="border rounded-lg p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[260px]">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {m.name}
                    {!m.is_active && <Badge variant="outline" className="text-xs">inactif</Badge>}
                    <Link
                      to={`/admin/produits/${m.id}`}
                      className="text-muted-foreground hover:text-primary"
                      title="Ouvrir la fiche"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {m.gtin && <span>GTIN {m.gtin} · </span>}
                    source: {m.source ?? "—"}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-rose-50 text-rose-700">
                    DB: {m.db_pack_size}
                  </Badge>
                  {m.regex_pack_size !== null && m.regex_pack_size !== m.db_pack_size && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                      libellé: {m.regex_pack_size}
                    </Badge>
                  )}
                  {m.gtin_twin_pack_size !== null && m.gtin_twin_pack_size !== m.db_pack_size && (
                    <Badge variant="outline" className="bg-sky-50 text-sky-700">
                      jumeau GTIN: {m.gtin_twin_pack_size}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">{m.reason}</Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => apply.mutate({ productId: m.id, newPackSize: m.suggested })}
                    disabled={apply.isPending}
                  >
                    <Wrench className="w-3.5 h-3.5 mr-1" />
                    Forcer {m.suggested}
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => validate.mutate(m.id)}
                    disabled={validate.isPending}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Marquer OK
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
