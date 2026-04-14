import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { applyMargin, formatPriceEur } from "@/lib/pricing";
import {
  Tag, Package, Trash2, Edit2, Download, Upload, TrendingDown, TrendingUp,
  BarChart3, Hash, X, Check, Loader2, ShoppingCart
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

function formatEur(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface UserPriceRow {
  id: string;
  product_id: string;
  my_purchase_price: number;
  supplier_name: string | null;
  notes: string | null;
  updated_at: string;
  product: {
    id: string;
    name: string;
    slug: string;
    gtin: string | null;
    brand_name: string | null;
    image_urls: string[] | null;
    best_price_excl_vat: number | null;
  } | null;
}

export default function MyPricesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToCart } = useCart();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editRow, setEditRow] = useState<UserPriceRow | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [importing, setImporting] = useState(false);

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["user-prices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_prices")
        .select("id, product_id, my_purchase_price, supplier_name, notes, updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      // Fetch product details
      const productIds = (data || []).map((d: any) => d.product_id);
      if (productIds.length === 0) return [];

      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, gtin, brand_name, image_urls, best_price_excl_vat")
        .in("id", productIds);

      const productMap = new Map((products || []).map((p: any) => [p.id, p]));

      return (data || []).map((row: any): UserPriceRow => ({
        ...row,
        product: productMap.get(row.product_id) || null,
      }));
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-prices"] });
      toast.success("Prix supprime");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, price, supplier }: { id: string; price: number; supplier: string }) => {
      const { error } = await supabase.from("user_prices").update({
        my_purchase_price: price,
        supplier_name: supplier || null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-prices"] });
      toast.success("Prix mis a jour");
      setEditRow(null);
    },
  });

  // Stats
  const stats = useMemo(() => {
    if (!prices.length) return { count: 0, avgSaving: 0, totalSaving: 0 };
    const savings = prices
      .map(p => {
        const mkPrice = applyMargin(p.product?.best_price_excl_vat || 0);
        return p.my_purchase_price - mkPrice;
      })
      .filter(s => s > 0);
    return {
      count: prices.length,
      avgSaving: savings.length ? savings.reduce((a, b) => a + b, 0) / savings.length : 0,
      totalSaving: savings.reduce((a, b) => a + b, 0),
    };
  }, [prices]);

  // Export CSV
  const exportCsv = () => {
    const header = "Produit;GTIN;Mon Prix;Fournisseur;Prix MediKong;Economie;Economie %\n";
    const rows = prices.map(p => {
      const mkPrice = applyMargin(p.product?.best_price_excl_vat || 0);
      const saving = p.my_purchase_price - mkPrice;
      const pct = p.my_purchase_price > 0 ? (saving / p.my_purchase_price * 100) : 0;
      return [
        `"${p.product?.name || ""}"`,
        p.product?.gtin || "",
        formatEur(p.my_purchase_price),
        `"${p.supplier_name || ""}"`,
        formatEur(mkPrice),
        formatEur(saving),
        `${pct.toFixed(1)}%`,
      ].join(";");
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mes-prix-medikong-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import CSV
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      // Skip header
      const dataLines = lines.slice(1);
      let imported = 0, notFound = 0;

      for (const line of dataLines) {
        const parts = line.split(/[;,]/).map(s => s.replace(/"/g, "").trim());
        const gtin = parts[0]; // First column = GTIN
        const price = parseFloat(parts[1]?.replace(",", ".") || "0");
        const supplier = parts[2] || null;

        if (!gtin || !price) continue;

        // Find product by GTIN
        const { data: product } = await supabase
          .from("products")
          .select("id")
          .eq("gtin", gtin)
          .maybeSingle();

        if (product) {
          await supabase.from("user_prices").upsert({
            user_id: user.id,
            product_id: product.id,
            my_purchase_price: price,
            supplier_name: supplier,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,product_id" });
          imported++;
        } else {
          notFound++;
        }
      }

      toast.success(`${imported} prix importes${notFound > 0 ? `, ${notFound} GTIN non trouves` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["user-prices"] });
    } catch {
      toast.error("Erreur lors de l'import");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <Tag size={48} className="mx-auto mb-4 text-muted-foreground/40" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Mes Prix</h1>
          <p className="text-muted-foreground mb-6">Connectez-vous pour acceder a votre espace prix.</p>
          <Link to="/connexion" className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity">
            Se connecter
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Mes Prix | MediKong</title>
        <meta name="description" content="Comparez vos prix d'achat actuels avec les prix MediKong et visualisez vos economies potentielles." />
      </Helmet>

      <div className="mk-container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Mes Prix</h1>
            <p className="text-muted-foreground text-sm mt-1">Comparez vos prix actuels avec MediKong</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportCsv} disabled={prices.length === 0} className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50">
              <Download size={16} /> Exporter CSV
            </button>
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Importer CSV
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="border border-border rounded-xl p-5 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Hash size={16} className="text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Produits suivis</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.count}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="border border-border rounded-xl p-5 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} className="text-green-600" />
              <span className="text-xs text-muted-foreground font-medium">Economie moyenne / produit</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatEur(stats.avgSaving)} EUR</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="border border-border rounded-xl p-5 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-green-600" />
              <span className="text-xs text-muted-foreground font-medium">Economie totale potentielle</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatEur(stats.totalSaving)} EUR</p>
          </motion.div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Chargement...</div>
        ) : prices.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Tag size={40} className="mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-bold text-foreground mb-2">Aucun prix sauvegarde</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Rendez-vous sur une fiche produit et utilisez le calculateur de marge pour sauvegarder votre prix actuel.
            </p>
            <Link to="/catalogue" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Parcourir le catalogue
            </Link>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Produit</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">GTIN</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Mon prix</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Fournisseur</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Prix MediKong</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Economie</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-right">%</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((row, i) => {
                    const mkPrice = applyMargin(row.product?.best_price_excl_vat || 0);
                    const saving = row.my_purchase_price - mkPrice;
                    const pct = row.my_purchase_price > 0 ? (saving / row.my_purchase_price * 100) : 0;
                    const isPositive = saving > 0;

                    return (
                      <tr key={row.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-4 py-3">
                          <Link to={`/produit/${row.product?.slug || ""}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {row.product?.image_urls?.[0] ? (
                                <img src={row.product.image_urls[0]} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <Package size={16} className="text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[200px]">{row.product?.name || "Produit inconnu"}</p>
                              {row.product?.brand_name && <p className="text-xs text-muted-foreground">{row.product.brand_name}</p>}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{row.product?.gtin || "—"}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{formatEur(row.my_purchase_price)} EUR</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.supplier_name || "—"}</td>
                        <td className="px-4 py-3 text-right font-bold text-primary">{formatEur(mkPrice)} EUR</td>
                        <td className={`px-4 py-3 text-right font-bold ${isPositive ? "text-green-700" : "text-red-600"}`}>
                          <span className="inline-flex items-center gap-1">
                            {isPositive ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                            {formatEur(Math.abs(saving))} EUR
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${isPositive ? "text-green-700" : "text-red-600"}`}>
                          {isPositive ? "+" : ""}{pct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => { setEditRow(row); setEditPrice(row.my_purchase_price.toString()); setEditSupplier(row.supplier_name || ""); }} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => deleteMutation.mutate(row.id)} className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import format help */}
        <div className="mt-6 text-xs text-muted-foreground">
          <p>Format CSV attendu : <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">GTIN;Prix;Fournisseur</code> (separateur : point-virgule ou virgule)</p>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier mon prix</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground truncate">{editRow.product?.name}</p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Mon prix (HTVA)</label>
                <Input type="text" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Fournisseur actuel</label>
                <Input type="text" value={editSupplier} onChange={e => setEditSupplier(e.target.value)} placeholder="Optionnel" />
              </div>
              <button
                onClick={() => {
                  const price = parseFloat(editPrice.replace(",", "."));
                  if (!price || price <= 0) { toast.error("Prix invalide"); return; }
                  updateMutation.mutate({ id: editRow.id, price, supplier: editSupplier });
                }}
                disabled={updateMutation.isPending}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {updateMutation.isPending ? "Sauvegarde..." : "Mettre a jour"}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
