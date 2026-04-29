import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ScanBarcode, Search, AlertTriangle, CheckCircle2, Loader2, Plus, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  describeCodeError, detectCodeKind, normalizeDigits,
} from "@/lib/product-codes";

type FoundProduct = {
  id: string;
  name: string;
  slug: string | null;
  gtin: string | null;
  cnk_code: string | null;
  brand_name: string | null;
  category_name: string | null;
  image_url: string | null;
  is_active: boolean;
};

export function VendorCatalogCodeLookup() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<FoundProduct | null>(null);
  const [touched, setTouched] = useState(false);

  const normalized = normalizeDigits(raw);
  const kind = detectCodeKind(normalized);
  const error = touched ? describeCodeError(normalized) : null;

  const lookup = useMutation({
    mutationFn: async () => {
      const code = normalizeDigits(raw);
      const k = detectCodeKind(code);
      if (!k) throw new Error("Format invalide");
      const column = k === "gtin" ? "gtin" : "cnk_code";
      const { data, error: err } = await supabase
        .from("products")
        .select("id, name, slug, gtin, cnk_code, brand_name, category_name, image_url, is_active")
        .eq(column, code)
        .eq("is_active", true)
        .maybeSingle();
      if (err) throw err;
      return (data as FoundProduct | null) ?? null;
    },
    onSuccess: (data) => setResult(data),
    onError: () => setResult(null),
  });

  const reset = () => {
    setRaw("");
    setResult(null);
    setTouched(false);
    lookup.reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!kind) return;
    lookup.mutate();
  };

  const startOffer = (productId: string) => {
    setOpen(false);
    navigate(`/vendor/offers?action=create&product=${productId}`);
  };

  const proposeNew = () => {
    setOpen(false);
    // Le formulaire de soumission s'ouvre côté catalogue ; on pré-remplit via state d'URL
    const param = kind === "gtin" ? `gtin=${normalized}` : `cnk=${normalized}`;
    navigate(`/vendor/catalog?submit=1&${param}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <ScanBarcode className="h-4 w-4" /> Recherche GTIN / CNK
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-primary" /> Recherche par code produit
          </DialogTitle>
          <DialogDescription>
            Saisissez un GTIN (8/12/13/14 chiffres) ou un CNK belge (7 chiffres).
            La clé de contrôle GTIN est vérifiée automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                inputMode="numeric"
                pattern="[0-9\s\-\.]*"
                maxLength={20}
                value={raw}
                onChange={(e) => { setRaw(e.target.value); setTouched(true); setResult(null); }}
                placeholder="ex. 5400123456789 ou 1234567"
                className="pl-8 h-9 font-mono"
                aria-invalid={!!error}
                aria-describedby="code-feedback"
              />
            </div>
            <Button type="submit" size="sm" className="h-9" disabled={!kind || lookup.isPending}>
              {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vérifier"}
            </Button>
          </div>

          <div id="code-feedback" className="min-h-[20px] text-xs">
            {error ? (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </span>
            ) : kind && normalized ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Format {kind.toUpperCase()} valide ({normalized.length} chiffres)
              </span>
            ) : (
              <span className="text-muted-foreground">
                Saisissez un code puis appuyez sur Entrée pour le rechercher dans le catalogue.
              </span>
            )}
          </div>
        </form>

        {lookup.isSuccess && (
          <div className="border rounded-lg p-3 mt-1">
            {result ? (
              <div className="flex gap-3 items-start">
                <div className="w-14 h-14 rounded bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                  {result.image_url ? (
                    <img src={result.image_url} alt={result.name} className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <ScanBarcode className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-2">{result.name}</p>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {result.brand_name && <span>{result.brand_name}</span>}
                    {result.cnk_code && <span>CNK {result.cnk_code}</span>}
                    {result.gtin && <span>GTIN {result.gtin}</span>}
                  </div>
                  {result.category_name && (
                    <Badge variant="secondary" className="text-[10px] mt-1">{result.category_name}</Badge>
                  )}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => startOffer(result.id)}>
                      <Plus className="h-3 w-3" /> Créer une offre
                    </Button>
                    {result.slug && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => { setOpen(false); navigate(`/produit/${result.slug}`); }}
                      >
                        <ExternalLink className="h-3 w-3" /> Voir la fiche
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-3 space-y-2">
                <p className="text-sm">
                  Aucun produit actif trouvé pour <span className="font-mono">{normalized}</span>.
                </p>
                <Button size="sm" variant="outline" className="gap-1" onClick={proposeNew}>
                  <Plus className="h-3 w-3" /> Proposer cette référence
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
