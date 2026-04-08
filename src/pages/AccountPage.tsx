import { Layout } from "@/components/layout/Layout";
import { useNavigate } from "react-router-dom";
import { ProductImage } from "@/components/shared/ProductCard";
import { Users, MapPin, Package, AlertCircle, Heart, Zap, Download, Layers, Mail, Phone, Clock, List, Plus, Trash2, Eye, ShoppingCart, Search, TrendingDown, BarChart3, Upload, FileSpreadsheet, Recycle } from "lucide-react";
import { BuyerImportModal } from "@/components/buyer/BuyerImportModal";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/data/mock";
import { useFeaturedProducts } from "@/hooks/useProducts";
import { useFavorites, useFavoriteLists, useRecentActivity } from "@/hooks/useFavorites";
import { usePriceWatches } from "@/hooks/usePriceWatches";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/hooks/useOrders";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const tabs = [
  { key: "profil", label: "Profil", icon: Users, disabled: false },
  { key: "adresses", label: "Adresses", icon: MapPin, disabled: false },
  { key: "commandes", label: "Commandes", icon: Package, disabled: false },
  { key: "reclamations", label: "Réclamations", icon: AlertCircle, disabled: false },
  { key: "favoris", label: "Favoris", icon: Heart, disabled: false },
  { key: "listes", label: "Mes listes", icon: List, disabled: false },
  { key: "activite", label: "Activité récente", icon: Clock, disabled: false },
  { key: "mesprix", label: "Mes prix", icon: BarChart3, disabled: false },
  { key: "categories", label: "Mes catégories", icon: Layers, disabled: false, href: "/compte/mes-categories" },
  { key: "portefeuille", label: "Portefeuille", icon: Zap, disabled: true },
  { key: "comparateur", label: "Comparateur", icon: FileSpreadsheet, disabled: false },
  { key: "catalogue", label: "Catalogue", icon: Download, disabled: false },
  { key: "restock", label: "ReStock", icon: Recycle, disabled: false, href: "/restock" },
  { key: "bnpl", label: "Payer plus tard", icon: Layers, disabled: true },
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

function DeleteAccountButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    if (!user || confirmText !== "SUPPRIMER") return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_user_account", { _user_id: user.id });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Votre compte a été supprimé");
      navigate("/");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  if (!confirming) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        Supprimer mon compte
      </Button>
    );
  }

  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-destructive">Tapez <strong>SUPPRIMER</strong> pour confirmer :</p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="SUPPRIMER"
        className="w-full max-w-xs border border-destructive/30 rounded-md px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" disabled={confirmText !== "SUPPRIMER" || deleting} onClick={handleDelete}>
          {deleting ? "Suppression..." : "Confirmer la suppression"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setConfirming(false); setConfirmText(""); }}>
          Annuler
        </Button>
      </div>
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
  const { data: dbOrders = [], isLoading: ordersLoading } = useOrders();
  const [activeTab, setActiveTab] = useState("profil");
  const [newListName, setNewListName] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  // ---- Profile state ----
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    country: "Belgique",
    vatNumber: "",
    sector: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (user) {
      const meta = user.user_metadata || {};
      const fullName = meta.full_name || "";
      const parts = fullName.split(" ");
      setProfileForm({
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        email: user.email || "",
        phone: meta.phone || "",
        companyName: meta.company_name || "",
        country: meta.country || "Belgique",
        vatNumber: meta.vat_number || "",
        sector: meta.sector || "",
      });
    }
  }, [user]);

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
          phone: profileForm.phone,
          company_name: profileForm.companyName,
          country: profileForm.country,
          vat_number: profileForm.vatNumber,
          sector: profileForm.sector,
        },
      });
      if (error) throw error;
      toast.success("Profil mis à jour avec succès");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setProfileSaving(false);
    }
  };

  // ---- Addresses state ----
  interface Address {
    id: string;
    label: string;
    type: "Livraison" | "Facturation";
    line1: string;
    line2: string;
    postalCode: string;
    city: string;
    country: string;
  }

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const emptyAddress: Address = { id: "", label: "", type: "Livraison", line1: "", line2: "", postalCode: "", city: "", country: "Belgique" };

  // Load addresses from customer record
  useEffect(() => {
    if (!user) return;
    supabase
      .from("customers")
      .select("id, address_line1, address_line2, postal_code, city, country_code, company_name")
      .eq("auth_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAddresses([
            {
              id: data.id,
              label: "Adresse principale",
              type: "Livraison",
              line1: data.address_line1 || "",
              line2: data.address_line2 || "",
              postalCode: data.postal_code || "",
              city: data.city || "",
              country: data.country_code === "FR" ? "France" : data.country_code === "CH" ? "Suisse" : "Belgique",
            },
          ]);
        }
      });
  }, [user]);

  const saveAddress = (addr: Address) => {
    if (addr.id) {
      setAddresses((prev) => prev.map((a) => (a.id === addr.id ? addr : a)));
    } else {
      setAddresses((prev) => [...prev, { ...addr, id: crypto.randomUUID() }]);
    }
    setEditingAddress(null);
    setShowAddressForm(false);
    toast.success("Adresse enregistrée");
  };

  const deleteAddress = (id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    toast.success("Adresse supprimée");
  };

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
                {tabs.map((t, i) => {
                  const isLink = 'href' in t && (t as any).href;
                  const inner = (
                    <>
                      <t.icon size={16} />
                      {t.label}
                      {t.disabled && <span className="text-[10px] ml-auto bg-muted text-muted-foreground rounded px-1.5 py-0.5">Prochainement</span>}
                    </>
                  );
                  if (isLink) {
                    return (
                      <motion.div key={t.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04 }}>
                        <Link to={(t as any).href} className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm whitespace-nowrap transition-colors text-mk-sec hover:bg-mk-alt">
                          {inner}
                        </Link>
                      </motion.div>
                    );
                  }
                  return (
                    <motion.button
                      key={t.key}
                      onClick={() => !t.disabled && setActiveTab(t.key)}
                      disabled={t.disabled}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                        t.disabled
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : activeTab === t.key
                            ? "bg-mk-blue text-white font-medium"
                            : "text-mk-sec hover:bg-mk-alt"
                      }`}
                      whileHover={t.disabled ? {} : { x: 4 }}
                      whileTap={t.disabled ? {} : { scale: 0.97 }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.04 }}
                    >
                      {inner}
                    </motion.button>
                  );
                })}
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
                        {([
                          ["Prénom", "firstName"],
                          ["Nom", "lastName"],
                          ["Email", "email"],
                          ["Téléphone", "phone"],
                        ] as const).map(([label, key], i) => (
                          <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                            <label className="text-xs text-mk-sec mb-1 block">{label}</label>
                            <input
                              value={(profileForm as any)[key]}
                              onChange={(e) => setProfileForm((f) => ({ ...f, [key]: e.target.value }))}
                              disabled={key === "email"}
                              className={`w-full border border-mk-line rounded-md px-3 py-2 text-sm ${key === "email" ? "bg-muted cursor-not-allowed" : ""}`}
                            />
                          </motion.div>
                        ))}
                      </div>
                      <h2 className="text-xl font-bold text-mk-navy mb-5">Informations entreprise</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        <div>
                          <label className="text-xs text-mk-sec mb-1 block">Nom entreprise</label>
                          <input value={profileForm.companyName} onChange={(e) => setProfileForm((f) => ({ ...f, companyName: e.target.value }))} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-mk-sec mb-1 block">Pays</label>
                          <select value={profileForm.country} onChange={(e) => setProfileForm((f) => ({ ...f, country: e.target.value }))} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm">
                            <option>Belgique</option><option>France</option><option>Suisse</option><option>Luxembourg</option><option>Pays-Bas</option><option>Allemagne</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-mk-sec mb-1 block">Numéro TVA</label>
                          <input value={profileForm.vatNumber} onChange={(e) => setProfileForm((f) => ({ ...f, vatNumber: e.target.value }))} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                        </div>
                        <ProfileSelector />
                      </div>
                      <motion.button
                        onClick={saveProfile}
                        disabled={profileSaving}
                        className="bg-mk-blue text-white font-semibold text-sm px-5 py-2.5 rounded-md disabled:opacity-50"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                      >
                        {profileSaving ? "Enregistrement..." : "Enregistrer les modifications"}
                      </motion.button>

                      {/* GDPR - Delete Account */}
                      <div className="mt-12 pt-8 border-t border-border">
                        <h3 className="text-lg font-bold text-foreground mb-2">Gestion de vos données (RGPD)</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Conformément au RGPD, vous pouvez demander la suppression de votre compte et de toutes vos données personnelles. Cette action est définitive et ne peut pas être annulée.
                        </p>
                        <DeleteAccountButton />
                      </div>
                    </div>
                  )}

                  {activeTab === "adresses" && (
                    <div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
                        <h2 className="text-xl font-bold text-mk-navy">Adresses</h2>
                        <motion.button
                          onClick={() => { setEditingAddress({ ...emptyAddress }); setShowAddressForm(true); }}
                          className="bg-mk-blue text-white text-sm px-4 py-2 rounded-md"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Ajouter une adresse
                        </motion.button>
                      </div>

                      {/* Address form */}
                      {showAddressForm && editingAddress && (
                        <motion.div
                          className="border border-mk-line rounded-lg p-5 mb-5 bg-mk-alt"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <h3 className="text-sm font-bold text-mk-navy mb-3">{editingAddress.id ? "Modifier l'adresse" : "Nouvelle adresse"}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="text-xs text-mk-sec mb-1 block">Libellé</label>
                              <input value={editingAddress.label} onChange={(e) => setEditingAddress({ ...editingAddress, label: e.target.value })} placeholder="Ex: Bureau, Entrepôt..." className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-mk-sec mb-1 block">Type</label>
                              <select value={editingAddress.type} onChange={(e) => setEditingAddress({ ...editingAddress, type: e.target.value as any })} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm">
                                <option>Livraison</option><option>Facturation</option>
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-xs text-mk-sec mb-1 block">Adresse ligne 1</label>
                              <input value={editingAddress.line1} onChange={(e) => setEditingAddress({ ...editingAddress, line1: e.target.value })} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-xs text-mk-sec mb-1 block">Adresse ligne 2</label>
                              <input value={editingAddress.line2} onChange={(e) => setEditingAddress({ ...editingAddress, line2: e.target.value })} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-mk-sec mb-1 block">Code postal</label>
                              <input value={editingAddress.postalCode} onChange={(e) => setEditingAddress({ ...editingAddress, postalCode: e.target.value })} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-mk-sec mb-1 block">Ville</label>
                              <input value={editingAddress.city} onChange={(e) => setEditingAddress({ ...editingAddress, city: e.target.value })} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-mk-sec mb-1 block">Pays</label>
                              <select value={editingAddress.country} onChange={(e) => setEditingAddress({ ...editingAddress, country: e.target.value })} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm">
                                <option>Belgique</option><option>France</option><option>Suisse</option><option>Luxembourg</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveAddress(editingAddress)}>Enregistrer</Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowAddressForm(false); setEditingAddress(null); }}>Annuler</Button>
                          </div>
                        </motion.div>
                      )}

                      {addresses.length === 0 && !showAddressForm && (
                        <p className="text-sm text-mk-sec py-8 text-center">Aucune adresse enregistrée. Cliquez sur "Ajouter une adresse" pour commencer.</p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {addresses.map((a, i) => (
                          <motion.div
                            key={a.id}
                            className="border border-mk-line rounded-lg p-5"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-mk-navy">{a.label || "Adresse"}</span>
                              <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded">{a.type}</span>
                            </div>
                            <p className="text-sm text-mk-sec mb-1">{a.line1}</p>
                            {a.line2 && <p className="text-sm text-mk-sec mb-1">{a.line2}</p>}
                            <p className="text-sm text-mk-sec mb-3">{a.postalCode} {a.city}, {a.country}</p>
                            <div className="flex gap-3">
                              <button onClick={() => { setEditingAddress({ ...a }); setShowAddressForm(true); }} className="text-xs text-mk-blue font-medium">Modifier</button>
                              <button onClick={() => deleteAddress(a.id)} className="text-xs text-destructive font-medium">Supprimer</button>
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
                      </div>
                      {ordersLoading ? (
                        <p className="text-sm text-mk-sec py-8 text-center">Chargement...</p>
                      ) : dbOrders.length === 0 ? (
                        <motion.div className="text-center py-16" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                          <Package size={40} className="mx-auto text-mk-ter mb-3" />
                          <h3 className="text-lg font-bold text-mk-navy mb-1">Aucune commande</h3>
                          <p className="text-sm text-mk-sec">Vos commandes apparaîtront ici après votre premier achat.</p>
                        </motion.div>
                      ) : (
                        <>
                          <div className="sm:hidden space-y-3">
                            {dbOrders.map((o: any, i: number) => (
                              <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                                <Link to={`/commande/${o.id}`} className="block border border-mk-line rounded-lg p-4">
                                  <div className="flex justify-between mb-2">
                                    <span className="font-medium text-mk-navy text-sm">{o.order_number}</span>
                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-mk-alt text-mk-sec">{o.status}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-mk-sec">{new Date(o.created_at).toLocaleDateString("fr-BE")}</span>
                                    <span className="font-bold text-mk-navy">{formatPrice(Number(o.total_incl_vat))} EUR</span>
                                  </div>
                                </Link>
                              </motion.div>
                            ))}
                          </div>
                          <motion.div className="hidden sm:block border border-mk-line rounded-lg overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className="grid grid-cols-4 gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec">
                              <span>ID Commande</span><span>Date</span><span>Statut</span><span>Montant</span>
                            </div>
                            {dbOrders.map((o: any, i: number) => (
                              <motion.div key={o.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
                                <Link to={`/commande/${o.id}`} className="grid grid-cols-4 gap-3 px-4 py-3 border-t border-mk-line text-sm items-center hover:bg-mk-alt">
                                  <span className="font-medium text-mk-navy">{o.order_number}</span>
                                  <span className="text-mk-sec">{new Date(o.created_at).toLocaleDateString("fr-BE")}</span>
                                  <span className="text-xs font-medium px-2 py-0.5 rounded w-fit bg-mk-alt text-mk-sec">{o.status}</span>
                                  <span className="font-bold text-mk-navy">{formatPrice(Number(o.total_incl_vat))} EUR</span>
                                </Link>
                              </motion.div>
                            ))}
                          </motion.div>
                        </>
                      )}
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

                  {activeTab === "comparateur" && (
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-5">Comparateur de prix</h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        Importez votre liste d'achats (fichier Excel avec codes EAN/CNK) pour comparer vos prix actuels avec les offres MediKong et identifier les économies possibles.
                      </p>
                      <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center bg-primary/5">
                        <FileSpreadsheet size={40} className="mx-auto mb-3 text-primary" />
                        <p className="text-sm font-semibold text-foreground mb-1">Analysez vos achats en un clic</p>
                        <p className="text-xs text-muted-foreground mb-4">Glissez votre fichier XLSX ou cliquez pour importer</p>
                        <Button onClick={() => setImportOpen(true)} className="gap-2">
                          <Upload size={14} /> Importer ma liste
                        </Button>
                      </div>
                      <div className="mt-6 grid grid-cols-3 gap-3">
                        <div className="border rounded-lg p-4 text-center">
                          <Search size={20} className="mx-auto mb-2 text-primary" />
                          <p className="text-xs font-semibold text-foreground">Matching EAN/CNK</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Recherche automatique dans +338k produits</p>
                        </div>
                        <div className="border rounded-lg p-4 text-center">
                          <TrendingDown size={20} className="mx-auto mb-2 text-primary" />
                          <p className="text-xs font-semibold text-foreground">Calcul d'économies</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Comparaison prix actuel vs MediKong</p>
                        </div>
                        <div className="border rounded-lg p-4 text-center">
                          <ShoppingCart size={20} className="mx-auto mb-2 text-primary" />
                          <p className="text-xs font-semibold text-foreground">Ajout au panier</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Sélection groupée en un clic</p>
                        </div>
                      </div>
                      <BuyerImportModal open={importOpen} onOpenChange={setImportOpen} />
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
