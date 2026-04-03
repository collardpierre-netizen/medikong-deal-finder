import { Layout } from "@/components/layout/Layout";
import { PageTransition } from "@/components/shared/PageTransition";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RotateCcw, Eye, EyeOff, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface ProfessionType {
  id: string;
  name: string;
  icon: string;
  default_category_ids: string[];
}

interface Category {
  id: string;
  name: string;
  name_fr: string | null;
  parent_id: string | null;
  icon: string | null;
  is_active: boolean;
}

export default function MesCategoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Fetch all categories (level 1)
  const { data: categories = [] } = useQuery({
    queryKey: ["all-categories-for-prefs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, name_fr, parent_id, icon, is_active")
        .is("parent_id", null)
        .eq("is_active", true)
        .order("display_order");
      return (data || []) as Category[];
    },
  });

  // Fetch profession types
  const { data: professionTypes = [] } = useQuery({
    queryKey: ["profession-types-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profession_types")
        .select("id, name, icon, default_category_ids")
        .eq("is_active", true)
        .order("name");
      return (data || []) as ProfessionType[];
    },
  });

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-category-prefs", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("profession_type_id, category_preferences, filter_mode")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [filterMode, setFilterMode] = useState<string>("filtered");
  const [categoryPrefs, setCategoryPrefs] = useState<Record<string, boolean>>({});
  const [professionTypeId, setProfessionTypeId] = useState<string>("");

  // Sync state from profile
  useEffect(() => {
    if (profile) {
      setFilterMode((profile.filter_mode as string) || "filtered");
      setCategoryPrefs((profile.category_preferences as Record<string, boolean>) || {});
      setProfessionTypeId(profile.profession_type_id || "");
    }
  }, [profile]);

  const currentProfession = professionTypes.find(p => p.id === professionTypeId);
  const defaultIds = new Set(currentProfession?.default_category_ids || []);

  const isCategoryEnabled = useCallback((catId: string) => {
    if (catId in categoryPrefs) return categoryPrefs[catId];
    return defaultIds.has(catId);
  }, [categoryPrefs, defaultIds]);

  const saveToDb = async (updates: { filter_mode?: string; category_preferences?: Record<string, boolean> | null; profession_type_id?: string | null }) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erreur de sauvegarde");
    } else {
      qc.invalidateQueries({ queryKey: ["user-category-prefs"] });
      qc.invalidateQueries({ queryKey: ["user-profession-profile"] });
    }
  };

  const handleToggleAll = async (checked: boolean) => {
    const newMode = checked ? "all" : "filtered";
    setFilterMode(newMode);
    await saveToDb({ filter_mode: newMode });
    toast.success(checked ? "Toutes les catégories affichées" : "Filtre par profil activé");
  };

  const handleToggleCategory = async (catId: string, checked: boolean) => {
    const newPrefs = { ...categoryPrefs, [catId]: checked };
    setCategoryPrefs(newPrefs);
    await saveToDb({ category_preferences: newPrefs });
  };

  const handleReset = async () => {
    setCategoryPrefs({});
    await saveToDb({ category_preferences: null });
    toast.success("Préférences réinitialisées selon votre profil");
  };

  const handleChangeProfession = async (newId: string) => {
    setProfessionTypeId(newId);
    setCategoryPrefs({});
    await saveToDb({ profession_type_id: newId || null, category_preferences: null });
    toast.success("Profil professionnel mis à jour");
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <p className="text-muted-foreground">Connectez-vous pour gérer vos catégories.</p>
          <Link to="/connexion" className="text-primary underline mt-2 inline-block">Se connecter</Link>
        </div>
      </Layout>
    );
  }

  const showAll = filterMode === "all";
  const hasOverrides = Object.keys(categoryPrefs).length > 0;

  return (
    <Layout>
      <PageTransition>
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Back link */}
          <Link to="/compte" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" /> Mon compte
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-2">Mes catégories</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Personnalisez les catégories affichées dans votre catalogue.
          </p>

          {/* Profession selector */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Profil professionnel</p>
                <p className="text-xs text-muted-foreground">Détermine les catégories par défaut</p>
              </div>
            </div>
            <Select value={professionTypeId} onValueChange={handleChangeProfession}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionnez votre profil…" />
              </SelectTrigger>
              <SelectContent>
                {professionTypes.map(pt => (
                  <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Global toggle */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showAll ? <Eye className="w-5 h-5 text-primary" /> : <EyeOff className="w-5 h-5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-foreground">Afficher toutes les catégories</p>
                <p className="text-xs text-muted-foreground">
                  {showAll ? "Le catalogue complet est affiché" : "Seules vos catégories sélectionnées sont affichées"}
                </p>
              </div>
            </div>
            <Switch checked={showAll} onCheckedChange={handleToggleAll} disabled={saving} />
          </div>

          {/* Reset button */}
          {hasOverrides && !showAll && (
            <div className="mb-4">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                Réinitialiser selon mon profil
              </Button>
            </div>
          )}

          {/* Category toggles */}
          <div className={`space-y-1 transition-opacity ${showAll ? "opacity-40 pointer-events-none" : ""}`}>
            {profileLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
            ) : (
              categories.map(cat => {
                const enabled = isCategoryEnabled(cat.id);
                const isDefault = defaultIds.has(cat.id);
                const isOverridden = cat.id in categoryPrefs;

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground">{cat.name_fr || cat.name}</span>
                      {isDefault && !isOverridden && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Par défaut</span>
                      )}
                      {isOverridden && (
                        <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded">Personnalisé</span>
                      )}
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => handleToggleCategory(cat.id, checked)}
                      disabled={saving}
                    />
                  </div>
                );
              })
            )}
          </div>

          {!currentProfession && !showAll && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Sélectionnez un profil professionnel pour voir les catégories par défaut.
              Sans profil, toutes les catégories sont affichées.
            </p>
          )}
        </div>
      </PageTransition>
    </Layout>
  );
}
