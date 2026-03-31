import { Layout } from "@/components/layout/Layout";
import { ProductImage } from "@/components/shared/ProductCard";
import { Users, MapPin, Package, AlertCircle, Heart, Zap, Download, Layers, Mail, Phone, Clock, List, Plus, Trash2, Eye, ShoppingCart, Search, TrendingDown, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/data/mock";
import { useFeaturedProducts } from "@/hooks/useProducts";
import { useFavorites, useFavoriteLists, useRecentActivity } from "@/hooks/useFavorites";
import { usePriceWatches } from "@/hooks/usePriceWatches";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const tabs = [
  { key: "profil", label: "Profil", icon: Users },
  { key: "adresses", label: "Adresses", icon: MapPin },
  { key: "commandes", label: "Commandes", icon: Package },
  { key: "reclamations", label: "Réclamations", icon: AlertCircle },
  { key: "favoris", label: "Favoris", icon: Heart },
  { key: "listes", label: "Mes listes", icon: List },
  { key: "activite", label: "Activité récente", icon: Clock },
  { key: "mesprix", label: "Mes prix", icon: BarChart3 },
  { key: "portefeuille", label: "Portefeuille", icon: Zap },
  { key: "catalogue", label: "Catalogue", icon: Download },
  { key: "bnpl", label: "Payer plus tard", icon: Layers },
];

const orders = [
  { id: "MK-2026-00847", date: "25/03/2026", status: "Livree", articles: 5, montant: 234.50 },
  { id: "MK-2026-00812", date: "18/03/2026", status: "Confirmee", articles: 3, montant: 89.90 },
  { id: "MK-2026-00798", date: "10/03/2026", status: "Expediee", articles: 8, montant: 456.00 },
];

const contentVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function ProfileSelector() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any).from("user_profiles").select("id, name").eq("is_active", true).order("display_order").then(({ data }: any) => {
      if (data) setProfiles(data);
    });
    if (user) {
      (supabase as any).from("user_profile_assignments").select("profile_id").eq("user_id", user.id).maybeSingle().then(({ data }: any) => {
        if (data) setCurrentProfileId(data.profile_id);
      });
    }
  }, [user]);

  const handleChange = async (newId: string) => {
    if (!user || !newId) return;
    setSaving(true);
    setCurrentProfileId(newId);
    await (supabase as any).from("user_profile_assignments").upsert({ user_id: user.id, profile_id: newId });
    setSaving(false);
  };

  return (
    <div>
      <label className="text-xs text-mk-sec mb-1 block">Profil professionnel</label>
      <select value={currentProfileId} onChange={e => handleChange(e.target.value)} disabled={saving} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm">
        <option value="">Sélectionnez...</option>
        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}

export default function AccountPage() {
  const { data: products = [] } = useFeaturedProducts(20);
  const { user } = useAuth();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { lists, createList, deleteList } = useFavoriteLists();
  const { activities } = useRecentActivity();
  const { watches, removeWatch } = usePriceWatches();
  const [activeTab, setActiveTab] = useState("profil");
  const [newListName, setNewListName] = useState("");

  return (
    <Layout>
      <PageTransition>
        <motion.div
          className="bg-mk-alt border-b border-mk-line py-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mk-container">
            <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">Mon compte</h1>
            <p className="text-sm text-mk-sec">Gerez votre profil, commandes et preferences</p>
          </div>
        </motion.div>
        <div className="mk-container py-6 md:py-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Sidebar */}
            <motion.aside
              className="md:w-[220px] shrink-0 md:border-r border-mk-line md:pr-6"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
                {tabs.map((t, i) => (
                  <motion.button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                      activeTab === t.key ? "bg-mk-blue text-white font-medium" : "text-mk-sec hover:bg-mk-alt"
                    }`}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.04 }}
                  >
                    <t.icon size={16} /> {t.label}
                  </motion.button>
                ))}
              </div>
            </motion.aside>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  variants={contentVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  {activeTab === "profil" && (
                    <div>
                      <h2 className="text-xl font-bold text-mk-navy mb-5">Informations personnelles</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {[["Prenom", "Jean"], ["Nom", "Dupont"], ["Email", "jean@pharmacie.be"], ["Telephone", "+32 478 12 34 56"]].map(([l, v], i) => (
                          <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                            <label className="text-xs text-mk-sec mb-1 block">{l}</label>
                            <input defaultValue={v} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                          </motion.div>
                        ))}
                      </div>
                      <h2 className="text-xl font-bold text-mk-navy mb-5">Informations entreprise</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        <div><label className="text-xs text-mk-sec mb-1 block">Nom entreprise</label><input defaultValue="Pharmacie Centrale" className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" /></div>
                        <div><label className="text-xs text-mk-sec mb-1 block">Pays</label>
                          <select className="w-full border border-mk-line rounded-md px-3 py-2 text-sm"><option>Belgique</option><option>France</option><option>Suisse</option></select>
                        </div>
                        <div><label className="text-xs text-mk-sec mb-1 block">Numero TVA</label><input defaultValue="BE 0123.456.789" className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" /></div>
                        <ProfileSelector />
                      </div>
                      <motion.button className="bg-mk-blue text-white font-semibold text-sm px-5 py-2.5 rounded-md" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>Enregistrer les modifications</motion.button>
                    </div>
                  )}

                  {activeTab === "adresses" && (
                    <div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
                        <h2 className="text-xl font-bold text-mk-navy">Adresses</h2>
                        <motion.button className="bg-mk-blue text-white text-sm px-4 py-2 rounded-md" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Ajouter une adresse</motion.button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: "Adresse principale", type: "Livraison", addr: "23 rue de la Procession\nB-7822 Ath, Belgique" },
                          { label: "Siege social", type: "Facturation", addr: "15 avenue Louise\nB-1050 Bruxelles, Belgique" },
                        ].map((a, i) => (
                          <motion.div
                            key={a.label}
                            className="border border-mk-line rounded-lg p-5"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-mk-navy">{a.label}</span>
                              <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded">{a.type}</span>
                            </div>
                            <p className="text-sm text-mk-sec whitespace-pre-line mb-3">{a.addr}</p>
                            <div className="flex gap-2">
                              <button className="text-xs text-mk-blue">Modifier</button>
                              <button className="text-xs text-mk-red">Supprimer</button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "commandes" && (
                    <div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
                        <h2 className="text-xl font-bold text-mk-navy">Commandes</h2>
                        <select className="border border-mk-line rounded-md px-3 py-1.5 text-sm">
                          <option>Toutes</option><option>Confirmee</option><option>Expediee</option><option>Livree</option><option>Annulee</option>
                        </select>
                      </div>
                      {/* Mobile cards */}
                      <div className="sm:hidden space-y-3">
                        {orders.map((o, i) => (
                          <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                            <Link to={`/commande/${o.id}`} className="block border border-mk-line rounded-lg p-4">
                              <div className="flex justify-between mb-2">
                                <span className="font-medium text-mk-navy text-sm">{o.id}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${o.status === "Livree" ? "bg-mk-deal text-mk-green" : o.status === "Confirmee" ? "bg-blue-50 text-mk-blue" : "bg-mk-mov-bg text-mk-amber"}`}>{o.status}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-mk-sec">{o.date} · {o.articles} articles</span>
                                <span className="font-bold text-mk-navy">{formatPrice(o.montant)} EUR</span>
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <motion.div
                        className="hidden sm:block border border-mk-line rounded-lg overflow-hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="grid grid-cols-5 gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec">
                          <span>ID Commande</span><span>Date</span><span>Statut</span><span>Articles</span><span>Montant</span>
                        </div>
                        {orders.map((o, i) => (
                          <motion.div
                            key={o.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + i * 0.06 }}
                          >
                            <Link to={`/commande/${o.id}`} className="grid grid-cols-5 gap-3 px-4 py-3 border-t border-mk-line text-sm items-center hover:bg-mk-alt">
                              <span className="font-medium text-mk-navy">{o.id}</span>
                              <span className="text-mk-sec">{o.date}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded w-fit ${o.status === "Livree" ? "bg-mk-deal text-mk-green" : o.status === "Confirmee" ? "bg-blue-50 text-mk-blue" : "bg-mk-mov-bg text-mk-amber"}`}>{o.status}</span>
                              <span className="text-mk-sec">{o.articles}</span>
                              <span className="font-bold text-mk-navy">{formatPrice(o.montant)} EUR</span>
                            </Link>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>
                  )}

                  {activeTab === "reclamations" && (
                    <motion.div className="text-center py-16" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}>
                      <AlertCircle size={40} className="mx-auto text-mk-ter mb-3" />
                      <h3 className="text-lg font-bold text-mk-navy mb-1">Aucune reclamation</h3>
                      <p className="text-sm text-mk-sec">Vos reclamations apparaitront ici</p>
                    </motion.div>
                  )}

                  {activeTab === "favoris" && (
                    <div>
                      <h2 className="text-xl font-bold text-mk-navy mb-5">Mes favoris</h2>
                      {!user ? (
                        <div className="text-center py-12 border border-mk-line rounded-xl">
                          <Heart size={36} className="mx-auto text-mk-ter mb-3" />
                          <p className="text-sm text-mk-sec mb-3">Connectez-vous pour sauvegarder vos favoris</p>
                          <Link to="/connexion"><Button className="bg-mk-blue hover:bg-[#1549b8] text-white">Se connecter</Button></Link>
                        </div>
                      ) : favorites.length === 0 ? (
                        <div className="text-center py-12 border border-mk-line rounded-xl">
                          <Heart size={36} className="mx-auto text-mk-ter mb-3" />
                          <h3 className="text-lg font-bold text-mk-navy mb-1">Aucun favori</h3>
                          <p className="text-sm text-mk-sec">Ajoutez des produits à vos favoris en cliquant sur le cœur</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {favorites.map((f: any, i: number) => (
                            <motion.div
                              key={f.id}
                              className="border border-mk-line rounded-lg p-4 relative"
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06 }}
                              whileHover={{ y: -4, boxShadow: "0 8px 20px rgba(0,0,0,0.08)" }}
                            >
                              <button
                                onClick={() => toggleFavorite.mutate(f.product_id)}
                                className="absolute top-3 right-3 z-10"
                              >
                                <Heart size={16} fill="#EF4343" className="text-mk-red" />
                              </button>
                              <Link to={`/produit/${f.products?.slug || f.product_id}`}>
                                <div className="aspect-square bg-mk-alt rounded-md mb-3 flex items-center justify-center">
                                  {f.products?.image_urls?.[0] ? (
                                    <img src={f.products.image_urls[0]} alt={f.products.name} className="object-contain w-full h-full p-2" />
                                  ) : (
                                    <Package size={32} className="text-mk-ter" />
                                  )}
                                </div>
                                <p className="text-xs text-mk-sec truncate">{f.products?.label || "Produit"}</p>
                                <p className="text-sm font-medium text-mk-text mb-2 truncate">{f.products?.name}</p>
                                {f.products?.best_price_incl_vat && (
                                  <span className="font-bold text-mk-navy text-sm">{formatPrice(f.products.best_price_incl_vat)} €</span>
                                )}
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "listes" && (
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-bold text-mk-navy">Mes listes</h2>
                      </div>
                      {!user ? (
                        <div className="text-center py-12 border border-mk-line rounded-xl">
                          <List size={36} className="mx-auto text-mk-ter mb-3" />
                          <p className="text-sm text-mk-sec mb-3">Connectez-vous pour créer des listes</p>
                          <Link to="/connexion"><Button className="bg-mk-blue hover:bg-[#1549b8] text-white">Se connecter</Button></Link>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2 mb-5">
                            <input
                              value={newListName}
                              onChange={e => setNewListName(e.target.value)}
                              placeholder="Nom de la nouvelle liste..."
                              className="flex-1 border border-mk-line rounded-md px-3 py-2 text-sm"
                            />
                            <Button
                              onClick={() => {
                                if (newListName.trim()) {
                                  createList.mutate({ name: newListName.trim() });
                                  setNewListName("");
                                  toast.success("Liste créée");
                                }
                              }}
                              className="bg-mk-blue hover:bg-[#1549b8] text-white gap-1.5"
                              size="sm"
                            >
                              <Plus size={14} /> Créer
                            </Button>
                          </div>
                          {lists.length === 0 ? (
                            <div className="text-center py-12 border border-mk-line rounded-xl">
                              <List size={36} className="mx-auto text-mk-ter mb-3" />
                              <h3 className="text-lg font-bold text-mk-navy mb-1">Aucune liste</h3>
                              <p className="text-sm text-mk-sec">Créez votre première liste pour organiser vos produits favoris</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {lists.map((list: any, i: number) => (
                                <motion.div
                                  key={list.id}
                                  className="border border-mk-line rounded-xl p-5"
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.06 }}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <h3 className="text-base font-bold text-mk-navy">{list.name}</h3>
                                      <p className="text-xs text-mk-sec">{list.favorite_list_items?.length || 0} produits</p>
                                    </div>
                                    <button
                                      onClick={() => { deleteList.mutate(list.id); toast.success("Liste supprimée"); }}
                                      className="text-mk-red hover:bg-red-50 p-2 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                  {list.favorite_list_items?.length > 0 ? (
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                      {list.favorite_list_items.slice(0, 6).map((item: any) => (
                                        <Link key={item.id} to={`/produit/${item.products?.slug || item.product_id}`} className="shrink-0 w-16 h-16 rounded-lg bg-mk-alt flex items-center justify-center overflow-hidden">
                                          {item.products?.image_urls?.[0] ? (
                                            <img src={item.products.image_urls[0]} alt="" className="object-contain w-full h-full p-1" />
                                          ) : (
                                            <Package size={20} className="text-mk-ter" />
                                          )}
                                        </Link>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-mk-ter italic">Liste vide — ajoutez des produits depuis le catalogue</p>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === "activite" && (
                    <div>
                      <h2 className="text-xl font-bold text-mk-navy mb-5">Activité récente</h2>
                      {!user ? (
                        <div className="text-center py-12 border border-mk-line rounded-xl">
                          <Clock size={36} className="mx-auto text-mk-ter mb-3" />
                          <p className="text-sm text-mk-sec mb-3">Connectez-vous pour voir votre activité</p>
                          <Link to="/connexion"><Button className="bg-mk-blue hover:bg-[#1549b8] text-white">Se connecter</Button></Link>
                        </div>
                      ) : activities.length === 0 ? (
                        <div className="text-center py-12 border border-mk-line rounded-xl">
                          <Clock size={36} className="mx-auto text-mk-ter mb-3" />
                          <h3 className="text-lg font-bold text-mk-navy mb-1">Aucune activité</h3>
                          <p className="text-sm text-mk-sec">Votre historique de navigation apparaîtra ici</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activities.map((a: any, i: number) => {
                            const iconMap: Record<string, any> = {
                              view_product: Eye,
                              search: Search,
                              add_to_cart: ShoppingCart,
                              order: Package,
                            };
                            const labelMap: Record<string, string> = {
                              view_product: "Produit consulté",
                              search: "Recherche",
                              add_to_cart: "Ajouté au panier",
                              order: "Commande",
                            };
                            const Icon = iconMap[a.activity_type] || Clock;
                            return (
                              <motion.div
                                key={a.id}
                                className="flex items-center gap-3 border border-mk-line rounded-lg p-3"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                              >
                                <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                                  <Icon size={16} className="text-[#1B5BDA]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-mk-navy truncate">
                                    {labelMap[a.activity_type] || a.activity_type}
                                    {a.products?.name && <span className="text-mk-sec font-normal"> — {a.products.name}</span>}
                                  </p>
                                  <p className="text-xs text-mk-ter">{new Date(a.created_at).toLocaleString("fr-BE")}</p>
                                </div>
                                {a.products?.slug && (
                                  <Link to={`/produit/${a.products.slug}`} className="text-xs text-mk-blue hover:underline shrink-0">Voir</Link>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "mesprix" && (
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h2 className="text-xl font-bold text-mk-navy">Mes prix</h2>
                          <p className="text-sm text-mk-sec">Suivez vos prix d'achat et comparez-les avec MediKong</p>
                        </div>
                      </div>
                      {!user ? (
                        <div className="text-center py-12 border border-mk-line rounded-xl">
                          <BarChart3 size={36} className="mx-auto text-mk-ter mb-3" />
                          <p className="text-sm text-mk-sec mb-3">Connectez-vous pour suivre vos prix</p>
                          <Link to="/connexion"><Button className="bg-mk-blue hover:bg-[#1549b8] text-white">Se connecter</Button></Link>
                        </div>
                      ) : watches.length === 0 ? (
                        <div className="text-center py-12 border border-mk-line rounded-xl">
                          <TrendingDown size={36} className="mx-auto text-mk-ter mb-3" />
                          <h3 className="text-lg font-bold text-mk-navy mb-1">Aucun prix suivi</h3>
                          <p className="text-sm text-mk-sec">Saisissez votre prix d'achat sur une fiche produit pour commencer</p>
                        </div>
                      ) : (
                        <>
                          {/* Summary stats */}
                          {(() => {
                            const totalSavings = watches.reduce((sum, w: any) => {
                              const mkPrice = w.products?.best_price_excl_vat || 0;
                              const diff = w.user_price_excl_vat - mkPrice;
                              return sum + (diff > 0 ? diff : 0);
                            }, 0);
                            const savingsCount = watches.filter((w: any) => {
                              const mkPrice = w.products?.best_price_excl_vat || 0;
                              return w.user_price_excl_vat > mkPrice;
                            }).length;
                            return (
                              <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-[#EFF6FF] rounded-xl p-4 text-center">
                                  <p className="text-2xl font-bold text-[#1B5BDA]">{watches.length}</p>
                                  <p className="text-xs text-mk-sec mt-1">Produits suivis</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-4 text-center">
                                  <p className="text-2xl font-bold text-mk-green">{savingsCount}</p>
                                  <p className="text-xs text-mk-sec mt-1">Économies possibles</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-4 text-center">
                                  <p className="text-2xl font-bold text-mk-green">{formatPrice(totalSavings)} €</p>
                                  <p className="text-xs text-mk-sec mt-1">Économie totale</p>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Table */}
                          <div className="border border-mk-line rounded-xl overflow-hidden">
                            <div className="hidden sm:grid grid-cols-6 gap-2 px-4 py-2.5 bg-mk-alt text-xs font-semibold text-mk-sec">
                              <span className="col-span-2">Produit</span>
                              <span className="text-right">Mon prix (HTVA)</span>
                              <span className="text-right">Meilleur MediKong</span>
                              <span className="text-right">Différence</span>
                              <span className="text-center">Actions</span>
                            </div>
                            {watches.map((w: any, i: number) => {
                              const mkPrice = w.products?.best_price_excl_vat || 0;
                              const diff = w.user_price_excl_vat - mkPrice;
                              const diffPct = w.user_price_excl_vat > 0 ? ((diff / w.user_price_excl_vat) * 100) : 0;
                              const hasSaving = diff > 0;
                              return (
                                <motion.div
                                  key={w.id}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                >
                                  {/* Mobile card */}
                                  <div className="sm:hidden border-t border-mk-line p-4 space-y-2">
                                    <Link to={`/produit/${w.products?.slug || w.product_id}`} className="text-sm font-medium text-mk-navy hover:text-mk-blue">
                                      {w.products?.name || "Produit"}
                                    </Link>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-mk-sec">Mon prix: <strong>{formatPrice(w.user_price_excl_vat)} €</strong></span>
                                      <span className="text-mk-sec">MK: <strong className="text-[#1B5BDA]">{formatPrice(mkPrice)} €</strong></span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className={`text-sm font-semibold ${hasSaving ? "text-mk-green" : "text-mk-red"}`}>
                                        {hasSaving ? "+" : ""}{formatPrice(diff)} € ({diffPct.toFixed(1)}%)
                                      </span>
                                      <button onClick={() => { removeWatch.mutate(w.id); toast.success("Suivi supprimé"); }} className="text-mk-red p-1">
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                    <div className={`text-xs font-medium px-2 py-1 rounded w-fit ${hasSaving ? "bg-green-50 text-mk-green" : "bg-blue-50 text-[#1B5BDA]"}`}>
                                      {hasSaving ? "📉 Économie possible" : "📊 MediKong plus cher"}
                                    </div>
                                  </div>
                                  {/* Desktop row */}
                                  <div className="hidden sm:grid grid-cols-6 gap-2 px-4 py-3 border-t border-mk-line items-center text-sm hover:bg-mk-alt">
                                    <div className="col-span-2">
                                      <Link to={`/produit/${w.products?.slug || w.product_id}`} className="font-medium text-mk-navy hover:text-mk-blue">
                                        {w.products?.name || "Produit"}
                                      </Link>
                                      <p className="text-xs text-mk-ter">{w.products?.label} · CNK: {w.products?.cnk_code}</p>
                                    </div>
                                    <p className="text-right font-medium">{formatPrice(w.user_price_excl_vat)} €</p>
                                    <p className="text-right font-medium text-[#1B5BDA]">{formatPrice(mkPrice)} €</p>
                                    <div className="text-right">
                                      <p className={`font-semibold ${hasSaving ? "text-mk-green" : "text-mk-red"}`}>
                                        {hasSaving ? "+" : ""}{formatPrice(diff)} €
                                      </p>
                                      <p className={`text-xs ${hasSaving ? "text-mk-green" : "text-mk-red"}`}>
                                        ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%)
                                      </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                      <span className={`text-xs font-medium px-2 py-1 rounded ${hasSaving ? "bg-green-50 text-mk-green" : "bg-blue-50 text-[#1B5BDA]"}`}>
                                        {hasSaving ? "📉 Économie" : "📊 Plus cher"}
                                      </span>
                                      <button onClick={() => { removeWatch.mutate(w.id); toast.success("Supprimé"); }} className="text-mk-red hover:bg-red-50 p-1.5 rounded transition-colors">
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === "portefeuille" && (
                    <div>
                      <h2 className="text-xl font-bold text-mk-navy mb-5">Portefeuille</h2>
                      <div className="text-center py-8">
                        <motion.div
                          className="text-4xl md:text-5xl font-bold text-mk-navy mb-4"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          0,00 EUR
                        </motion.div>
                        <div className="flex justify-center gap-3">
                          <motion.button className="bg-mk-blue text-white text-sm px-5 py-2 rounded-md" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Recharger</motion.button>
                          <motion.button className="border border-mk-line text-sm px-5 py-2 rounded-md text-mk-sec" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Retirer</motion.button>
                        </div>
                      </div>
                      <motion.div
                        className="bg-mk-mov-bg border border-mk-mov-border rounded-lg p-5 mt-6"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <h3 className="text-sm font-bold text-mk-navy mb-2">Comment utiliser votre portefeuille ?</h3>
                        <ul className="text-sm text-mk-sec space-y-1">
                          <li>Rechargez via virement ou carte bancaire</li>
                          <li>Payez vos commandes instantanement</li>
                          <li>Beneficiez de remises supplementaires</li>
                          <li>Retirez votre solde a tout moment</li>
                        </ul>
                      </motion.div>
                    </div>
                  )}

                  {activeTab === "catalogue" && (
                    <div>
                      <h2 className="text-xl font-bold text-mk-navy mb-5">Catalogue</h2>
                      <div className="flex gap-3 mb-6">
                        <motion.button className="flex-1 border-2 border-mk-blue rounded-lg p-4 text-center" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <Mail size={20} className="mx-auto mb-1 text-mk-blue" /><span className="text-sm font-medium text-mk-navy">Par Email</span>
                        </motion.button>
                        <motion.button className="flex-1 border border-mk-line rounded-lg p-4 text-center text-mk-sec" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <Download size={20} className="mx-auto mb-1" /><span className="text-sm font-medium">Par API</span>
                        </motion.button>
                      </div>
                      <div className="space-y-4">
                        <div><label className="text-xs text-mk-sec mb-1 block">Email</label><input placeholder="votre@email.com" className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" /></div>
                        <div><label className="text-xs text-mk-sec mb-1 block">Langue</label>
                          <select className="w-full border border-mk-line rounded-md px-3 py-2 text-sm"><option>Francais</option><option>English</option><option>Nederlands</option></select>
                        </div>
                        <motion.button className="bg-mk-blue text-white text-sm font-semibold px-5 py-2.5 rounded-md" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>Envoyer le catalogue</motion.button>
                      </div>
                    </div>
                  )}

                  {activeTab === "bnpl" && (
                    <div>
                      <h2 className="text-xl font-bold text-mk-navy mb-5">Payer plus tard</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-bold text-mk-navy mb-3">Conditions</h3>
                          <ul className="text-sm text-mk-sec space-y-2">
                            {["Paiement en 2, 3 ou 4 versements", "Sans frais supplementaires", "Montant minimum: 100 EUR", "Verification instantanee", "Livraison avant le premier paiement"].map((item, i) => (
                              <motion.li key={item} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>{item}</motion.li>
                            ))}
                          </ul>
                        </div>
                        <motion.div
                          className="bg-mk-deal rounded-lg p-5"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.15 }}
                        >
                          <h3 className="text-sm font-bold text-mk-navy mb-3">Avantages</h3>
                          {["Trésorerie préservée", "Process 100% digital", "Aucun frais caché", "Compatible toutes commandes", "Support dédié"].map((a, i) => (
                            <motion.div key={a} className="flex items-center gap-2 text-sm text-mk-green mb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.05 }}>
                              <span className="w-4 h-4 rounded-full bg-mk-green/20 flex items-center justify-center"><span className="text-xs">✓</span></span> {a}
                            </motion.div>
                          ))}
                        </motion.div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                        {["Aujourd'hui", "1 mois", "2 mois", "3 mois"].map((p, i) => (
                          <motion.div
                            key={p}
                            className="bg-mk-mov-bg border border-mk-mov-border rounded-lg p-4 text-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.08 }}
                            whileHover={{ scale: 1.04 }}
                          >
                            <div className="text-xs text-mk-sec mb-1">{p}</div>
                            <div className="text-lg font-bold text-mk-navy">250,00 EUR</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
