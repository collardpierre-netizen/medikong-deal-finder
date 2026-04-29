import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BellRing, Search, Trash2, Pencil, Loader2, ArrowLeft, History } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePriceWatches, type PriceWatch } from "@/hooks/usePriceWatches";
import { useToast } from "@/hooks/use-toast";
import { formatUpdatedAt } from "@/lib/format-date";
import { MEDIKONG_PLACEHOLDER, isValidProductImage } from "@/lib/image-utils";

export default function MyPriceAlertsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { watches, isLoading, savePrice, removeWatch } = usePriceWatches();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PriceWatch | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");

  if (!loading && !user) {
    navigate("/login?redirect=/mes-alertes-prix");
    return null;
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return watches;
    return watches.filter((w) => {
      const name = w.products?.name?.toLowerCase() ?? "";
      const cnk = w.products?.cnk_code?.toLowerCase() ?? "";
      const gtin = w.products?.gtin?.toLowerCase() ?? "";
      const notes = (w.notes ?? "").toLowerCase();
      return name.includes(q) || cnk.includes(q) || gtin.includes(q) || notes.includes(q);
    });
  }, [watches, search]);

  const stats = useMemo(() => {
    let triggered = 0;
    let totalDelta = 0;
    let countWithMk = 0;
    watches.forEach((w) => {
      const mk = w.products?.best_price_excl_vat;
      if (mk != null && mk > 0) {
        countWithMk++;
        totalDelta += w.user_price_excl_vat - mk;
        if (mk <= w.user_price_excl_vat) triggered++;
      }
    });
    return {
      total: watches.length,
      triggered,
      avgDelta: countWithMk > 0 ? totalDelta / countWithMk : 0,
    };
  }, [watches]);

  const openEdit = (w: PriceWatch) => {
    setEditing(w);
    setEditPrice(String(w.user_price_excl_vat));
    setEditNotes(w.notes ?? "");
  };

  const handleSave = async () => {
    if (!editing) return;
    const num = parseFloat(editPrice.replace(",", "."));
    if (!isFinite(num) || num <= 0) {
      toast({ title: "Prix invalide", description: "Saisissez un montant HTVA en EUR." });
      return;
    }
    try {
      await savePrice.mutateAsync({ productId: editing.product_id, price: num, notes: editNotes });
      toast({ title: "Alerte mise à jour" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message ?? "Impossible d'enregistrer.", variant: "destructive" });
    }
  };

  const handleRemove = async (w: PriceWatch) => {
    if (!confirm(`Supprimer l'alerte pour "${w.products?.name ?? "ce produit"}" ?`)) return;
    try {
      await removeWatch.mutateAsync(w.id);
      toast({ title: "Alerte supprimée" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message ?? "Suppression impossible.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Mes alertes prix | MediKong</title>
        <meta name="description" content="Consultez, modifiez et supprimez toutes vos alertes prix MediKong en un seul endroit." />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/compte" className="inline-flex items-center gap-1 text-sm text-mk-sec hover:text-mk-blue mb-4">
          <ArrowLeft size={14} /> Retour au compte
        </Link>

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-mk-navy flex items-center gap-2">
            <BellRing size={22} className="text-mk-blue" />
            Mes alertes prix
          </h1>
          <p className="text-sm text-mk-sec mt-1">
            Vous êtes notifié dès qu'un vendeur passe sous votre prix cible (HTVA).
          </p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="border border-mk-line rounded-lg p-4">
            <div className="text-xs text-mk-sec">Alertes actives</div>
            <div className="text-2xl font-bold text-mk-navy">{stats.total}</div>
          </div>
          <div className="border border-mk-line rounded-lg p-4">
            <div className="text-xs text-mk-sec">Cibles atteintes</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.triggered}</div>
          </div>
          <div className="border border-mk-line rounded-lg p-4">
            <div className="text-xs text-mk-sec">Écart moyen vs MK</div>
            <div className={`text-2xl font-bold ${stats.avgDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {stats.avgDelta >= 0 ? "+" : ""}{stats.avgDelta.toFixed(2)} €
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-ter" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, CNK, GTIN ou notes…"
            className="pl-9"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-mk-sec">
            <Loader2 size={20} className="animate-spin inline mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-mk-line rounded-lg">
            <Bell size={32} className="mx-auto text-mk-ter mb-3" />
            <p className="text-sm font-medium text-mk-text">
              {watches.length === 0 ? "Aucune alerte prix pour l'instant" : "Aucun résultat pour cette recherche"}
            </p>
            <p className="text-xs text-mk-sec mt-1">
              {watches.length === 0
                ? "Cliquez sur la cloche d'un produit du catalogue pour créer votre première alerte."
                : "Modifiez votre recherche ou réinitialisez le filtre."}
            </p>
            {watches.length === 0 && (
              <Link to="/catalogue" className="inline-block mt-4">
                <Button size="sm">Parcourir le catalogue</Button>
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((w) => {
              const p = w.products;
              const img = p?.image_urls?.find(isValidProductImage) ?? MEDIKONG_PLACEHOLDER;
              const mk = p?.best_price_excl_vat;
              const delta = mk != null ? w.user_price_excl_vat - mk : null;
              const triggered = delta != null && delta >= 0;
              return (
                <li key={w.id} className="border border-mk-line rounded-lg p-3 flex gap-3 hover:border-mk-blue/40 transition-colors">
                  <Link to={`/produit/${p?.slug ?? ""}`} className="shrink-0">
                    <div className="w-16 h-16 rounded bg-muted overflow-hidden">
                      <img src={img} alt={p?.name ?? ""} loading="lazy" className="w-full h-full object-contain p-1" />
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/produit/${p?.slug ?? ""}`} className="text-sm font-medium text-mk-text hover:text-mk-blue line-clamp-1">
                      {p?.name ?? "Produit indisponible"}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mk-sec mt-1">
                      {p?.cnk_code && <span>CNK {p.cnk_code}</span>}
                      {p?.gtin && <span>GTIN {p.gtin}</span>}
                      <span className="inline-flex items-center gap-1">
                        <History size={11} /> Maj {formatUpdatedAt(w.updated_at)}
                      </span>
                    </div>
                    {w.notes && <p className="text-xs text-mk-ter mt-1 line-clamp-1 italic">"{w.notes}"</p>}
                  </div>
                  <div className="flex flex-col items-end justify-between shrink-0 min-w-[140px]">
                    <div className="text-right">
                      <div className="text-xs text-mk-sec">Cible HTVA</div>
                      <div className="text-base font-bold text-mk-navy">{w.user_price_excl_vat.toFixed(2)} €</div>
                      {mk != null && (
                        <div className={`text-[11px] font-medium ${triggered ? "text-emerald-600" : "text-mk-ter"}`}>
                          MK {mk.toFixed(2)} € ({delta != null ? (delta >= 0 ? "+" : "") + delta.toFixed(2) : "—"} €)
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(w)} className="h-8 px-2">
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(w)} className="h-8 px-2 text-destructive hover:text-destructive">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Edit modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'alerte prix</DialogTitle>
            <DialogDescription>
              {editing?.products?.name && <span className="font-medium">{editing.products.name}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-mk-sec mb-1 block">Prix cible HTVA (EUR)</label>
              <Input type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-mk-sec mb-1 block">Notes (optionnel)</label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={savePrice.isPending}>
              {savePrice.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
