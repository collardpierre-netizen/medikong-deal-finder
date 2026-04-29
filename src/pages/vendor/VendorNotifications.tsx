import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Plus, Trash2, Loader2, Building2, Tag, Layers, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import {
  useVendorNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useVendorNotifications";
import {
  useVendorCatalogInterests,
  useAddVendorCatalogInterest,
  useDeleteVendorCatalogInterest,
  useUpdateVendorCatalogInterest,
  type InterestScope,
} from "@/hooks/useVendorCatalogInterests";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function ScopeIcon({ scope }: { scope?: InterestScope }) {
  if (scope === "manufacturer") return <Building2 size={14} />;
  if (scope === "brand") return <Tag size={14} />;
  return <Layers size={14} />;
}

function scopeLabel(scope?: InterestScope) {
  if (scope === "manufacturer") return "Fabricant";
  if (scope === "brand") return "Marque";
  return "Catégorie";
}

function AddInterestDialog({ vendorId }: { vendorId?: string }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<InterestScope>("brand");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notifyProduct, setNotifyProduct] = useState(true);
  const [notifyBrand, setNotifyBrand] = useState(true);
  const addMutation = useAddVendorCatalogInterest(vendorId);

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["interest-picker", scope, search],
    queryFn: async () => {
      const term = search.trim();
      const table = scope === "manufacturer" ? "manufacturers" : scope === "brand" ? "brands" : "categories";
      let q = supabase.from(table).select("id, name").eq("is_active", true).order("name").limit(20);
      if (term) q = q.ilike("name", `%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
    enabled: open,
  });

  const reset = () => {
    setSearch("");
    setSelectedId(null);
    setNotifyProduct(true);
    setNotifyBrand(true);
  };

  const onSubmit = async () => {
    if (!selectedId) {
      toast.error("Sélectionnez une cible");
      return;
    }
    try {
      await addMutation.mutateAsync({
        scope,
        target_id: selectedId,
        notify_new_product: notifyProduct,
        notify_new_brand: notifyBrand,
      });
      toast.success("Centre d'intérêt ajouté");
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'ajout");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><Plus size={14} /> Ajouter un intérêt</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau centre d'intérêt</DialogTitle>
          <DialogDescription>
            Soyez notifié dès qu'un nouveau produit, marque ou opportunité matche votre périmètre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Label className="col-span-3">Type de cible</Label>
            <Select value={scope} onValueChange={(v) => { setScope(v as InterestScope); setSelectedId(null); }}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manufacturer">Fabricant</SelectItem>
                <SelectItem value="brand">Marque</SelectItem>
                <SelectItem value="category">Catégorie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cible</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Rechercher un${scope === "manufacturer" ? " fabricant" : scope === "brand" ? "e marque" : "e catégorie"}…`}
                className="pl-9"
              />
            </div>
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="inline animate-spin" size={14} /> Chargement…
                </div>
              ) : options.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Aucun résultat</div>
              ) : (
                options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedId(o.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition ${selectedId === o.id ? "bg-primary/10 font-medium" : ""}`}
                  >
                    {o.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="np" className="text-sm">Notifier les nouveaux produits</Label>
              <Switch id="np" checked={notifyProduct} onCheckedChange={setNotifyProduct} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="nb" className="text-sm">Notifier les nouvelles marques</Label>
              <Switch id="nb" checked={notifyBrand} onCheckedChange={setNotifyBrand} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={onSubmit} disabled={addMutation.isPending || !selectedId}>
            {addMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotificationItem({
  notif,
  onMarkRead,
}: {
  notif: any;
  onMarkRead: (id: string) => void;
}) {
  const isUnread = !notif.read_at;
  return (
    <div
      className={`p-4 border rounded-lg transition ${isUnread ? "bg-primary/5 border-primary/20" : "bg-background"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUnread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Bell size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{notif.title}</p>
              {notif.body && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>}
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">{notif.type}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
            </span>
            <div className="flex items-center gap-2">
              {notif.cta_url && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                  <Link to={notif.cta_url}>Voir →</Link>
                </Button>
              )}
              {isUnread && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onMarkRead(notif.id)}>
                  <Check size={12} /> Marquer lu
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VendorNotifications() {
  const { data: vendor, isLoading: vendorLoading } = useCurrentVendor();
  const vendorId = vendor?.id;

  const { data: notifs = [], isLoading: notifLoading } = useVendorNotifications(vendorId);
  const { data: interests = [], isLoading: interestsLoading } = useVendorCatalogInterests(vendorId);

  const markRead = useMarkNotificationRead(vendorId);
  const markAll = useMarkAllNotificationsRead(vendorId);
  const deleteInterest = useDeleteVendorCatalogInterest(vendorId);
  const updateInterest = useUpdateVendorCatalogInterest(vendorId);

  const unreadCount = useMemo(() => notifs.filter((n: any) => !n.read_at).length, [notifs]);
  const previewNotifs = notifs.slice(0, 5);

  if (vendorLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell size={22} /> Notifications & centres d'intérêt
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les marques, fabricants et catégories que vous suivez. Recevez des alertes dès qu'un nouveau produit pertinent rejoint MediKong.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck size={14} /> Tout marquer comme lu ({unreadCount})
          </Button>
        )}
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="history">
            Historique {notifs.length > 0 && <Badge variant="secondary" className="ml-2">{notifs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="interests">
            Centres d'intérêt {interests.length > 0 && <Badge variant="secondary" className="ml-2">{interests.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* APERÇU */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Notifications non lues</CardDescription>
                <CardTitle className="text-3xl">{unreadCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total notifications</CardDescription>
                <CardTitle className="text-3xl">{notifs.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Centres d'intérêt actifs</CardDescription>
                <CardTitle className="text-3xl">{interests.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">5 notifications les plus récentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : previewNotifs.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Aucune notification pour le moment.
                </div>
              ) : (
                previewNotifs.map((n: any) => (
                  <NotificationItem key={n.id} notif={n} onMarkRead={(id) => markRead.mutate(id)} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORIQUE */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {notifLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : notifs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Aucune notification reçue.
              </CardContent>
            </Card>
          ) : (
            notifs.map((n: any) => (
              <NotificationItem key={n.id} notif={n} onMarkRead={(id) => markRead.mutate(id)} />
            ))
          )}
        </TabsContent>

        {/* INTÉRÊTS */}
        <TabsContent value="interests" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Définissez les marques, fabricants ou catégories que vous suivez pour recevoir les bonnes alertes.
            </p>
            <AddInterestDialog vendorId={vendorId} />
          </div>

          {interestsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : interests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell size={28} className="mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mt-3">
                  Aucun centre d'intérêt défini. Ajoutez-en pour être alerté des nouveautés.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {interests.map((it) => (
                <Card key={it.id}>
                  <CardContent className="flex items-center justify-between gap-4 py-3 px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <ScopeIcon scope={it.scope} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{scopeLabel(it.scope)}</Badge>
                          <p className="text-sm font-medium truncate">{it.label}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Ajouté le {new Date(it.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden md:flex items-center gap-2 text-xs">
                        <Switch
                          checked={it.notify_new_product}
                          onCheckedChange={(v) => updateInterest.mutate({ id: it.id, notify_new_product: v })}
                        />
                        <span className="text-muted-foreground">Produits</span>
                      </div>
                      <div className="hidden md:flex items-center gap-2 text-xs">
                        <Switch
                          checked={it.notify_new_brand}
                          onCheckedChange={(v) => updateInterest.mutate({ id: it.id, notify_new_brand: v })}
                        />
                        <span className="text-muted-foreground">Marques</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Supprimer ce centre d'intérêt ?")) deleteInterest.mutate(it.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
