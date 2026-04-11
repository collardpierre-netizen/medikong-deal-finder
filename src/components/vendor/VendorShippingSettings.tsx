import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Package, Truck, ShieldCheck, Check, AlertTriangle, Loader2,
  Eye, EyeOff, ExternalLink, Wifi, WifiOff
} from "lucide-react";
import { toast } from "sonner";

type ShippingMode = "no_shipping" | "own_sendcloud" | "medikong_whitelabel";

interface Props {
  vendorId: string;
  currentMode: ShippingMode;
  marginPercentage: number;
}

const MODES = [
  {
    id: "no_shipping" as const,
    icon: Package,
    title: "Je gère mes expéditions moi-même",
    description: "Vous gérez l'envoi en dehors de Medikong. Vous pourrez ajouter un numéro de suivi manuellement sur chaque commande.",
    pros: ["Aucune configuration nécessaire", "Liberté totale"],
    cons: ["Pas de suivi automatique", "Pas d'étiquettes intégrées"],
  },
  {
    id: "own_sendcloud" as const,
    icon: Truck,
    title: "J'ai déjà un compte Sendcloud",
    description: "Connectez votre propre compte Sendcloud pour générer vos étiquettes et suivre vos colis directement depuis Medikong.",
    pros: ["Vos tarifs transporteurs", "Votre facturation Sendcloud directe"],
    cons: ["Configuration initiale requise"],
  },
  {
    id: "medikong_whitelabel" as const,
    icon: ShieldCheck,
    title: "Utiliser Medikong Shipping",
    descriptionFn: (margin: number) =>
      `Medikong s'occupe de tout : tarifs négociés, étiquettes, suivi, support. Une commission de ${margin}% est appliquée sur chaque envoi.`,
    description: "",
    pros: ["Aucune configuration transporteur", "Tarifs négociés", "Support inclus"],
    cons: ["Commission Medikong sur chaque envoi"],
  },
];

export default function VendorShippingSettings({ vendorId, currentMode, marginPercentage }: Props) {
  const [selectedMode, setSelectedMode] = useState<ShippingMode>(currentMode);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<ShippingMode | null>(null);
  const qc = useQueryClient();

  // Sendcloud credentials
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: credentials, isLoading: credentialsLoading } = useQuery({
    queryKey: ["vendor-sendcloud-credentials", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_sendcloud_credentials")
        .select("*")
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: currentMode === "own_sendcloud" || selectedMode === "own_sendcloud",
  });

  const updateModeMutation = useMutation({
    mutationFn: async (newMode: ShippingMode) => {
      const { error } = await supabase
        .from("vendors")
        .update({ vendor_shipping_mode: newMode } as any)
        .eq("id", vendorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mode d'expédition mis à jour");
      qc.invalidateQueries({ queryKey: ["current-vendor"] });
      setConfirmDialogOpen(false);
      setPendingMode(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveCredentialsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vendor_sendcloud_credentials")
        .upsert({
          vendor_id: vendorId,
          sendcloud_public_key: publicKey,
          sendcloud_secret_key: secretKey,
          is_connected: false,
        } as any, { onConflict: "vendor_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Identifiants enregistrés");
      qc.invalidateQueries({ queryKey: ["vendor-sendcloud-credentials", vendorId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await supabase.functions.invoke("sendcloud-api", {
        body: {
          action: "test_connection",
          vendor_id: vendorId,
          public_key: publicKey || credentials?.sendcloud_public_key,
          secret_key: secretKey || credentials?.sendcloud_secret_key,
        },
      });
      if (res.error) throw res.error;
      if (res.data?.success) {
        toast.success("Connexion Sendcloud vérifiée ✓");
        // Mark as connected
        await supabase
          .from("vendor_sendcloud_credentials")
          .update({ is_connected: true, last_verified_at: new Date().toISOString() } as any)
          .eq("vendor_id", vendorId);
        qc.invalidateQueries({ queryKey: ["vendor-sendcloud-credentials", vendorId] });
      } else {
        toast.error(res.data?.error || "Échec de connexion Sendcloud");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de test");
    } finally {
      setTesting(false);
    }
  };

  const handleModeSelect = (mode: ShippingMode) => {
    if (mode === currentMode) return;
    setPendingMode(mode);
    setConfirmDialogOpen(true);
  };

  const confirmModeSwitch = () => {
    if (pendingMode) {
      updateModeMutation.mutate(pendingMode);
      setSelectedMode(pendingMode);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#1D2530] mb-1">Mode d'expédition</h2>
        <p className="text-sm text-[#8B95A5]">
          Choisissez comment vous souhaitez gérer l'expédition de vos commandes.
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id;
          const Icon = mode.icon;
          const desc = mode.id === "medikong_whitelabel"
            ? mode.descriptionFn!(marginPercentage)
            : mode.description;

          return (
            <div
              key={mode.id}
              className={`relative rounded-xl border-2 p-5 transition-all cursor-pointer hover:shadow-md ${
                isActive
                  ? "border-[#1B5BDA] bg-blue-50/50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
              onClick={() => handleModeSelect(mode.id)}
            >
              {isActive && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#1B5BDA] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isActive ? "bg-[#1B5BDA] text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#1D2530] leading-tight">{mode.title}</h3>
              </div>

              <p className="text-xs text-[#8B95A5] mb-4 leading-relaxed">{desc}</p>

              <div className="space-y-2">
                {mode.pros.map((p) => (
                  <div key={p} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-[#4A5568]">{p}</span>
                  </div>
                ))}
                {mode.cons.map((c) => (
                  <div key={c} className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-[#4A5568]">{c}</span>
                  </div>
                ))}
              </div>

              {isActive && (
                <div className="mt-4">
                  <VBadge variant="info">Mode actif</VBadge>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sendcloud credentials form (only for own_sendcloud) */}
      {currentMode === "own_sendcloud" && (
        <VCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1D2530]">Connexion Sendcloud</h3>
              {credentials?.is_connected ? (
                <VBadge variant="success" className="flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Connecté
                </VBadge>
              ) : (
                <VBadge variant="warning" className="flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Non connecté
                </VBadge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Clé publique Sendcloud</Label>
                <Input
                  value={publicKey || credentials?.sendcloud_public_key || ""}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="Votre clé publique..."
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Clé secrète Sendcloud</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={secretKey || credentials?.sendcloud_secret_key || ""}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Votre clé secrète..."
                    className="text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <VBtn
                size="sm"
                onClick={() => saveCredentialsMutation.mutate()}
                disabled={saveCredentialsMutation.isPending}
              >
                {saveCredentialsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Enregistrer
              </VBtn>
              <VBtn
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Tester la connexion
              </VBtn>
              <a
                href="https://panel.sendcloud.sc/v2/settings/integrations/api/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#1B5BDA] hover:underline flex items-center gap-1"
              >
                Obtenir les clés <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </VCard>
      )}

      {/* Whitelabel info */}
      {currentMode === "medikong_whitelabel" && (
        <VCard>
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1B5BDA]" />
              <h3 className="text-sm font-bold text-[#1D2530]">Medikong Shipping — Actif</h3>
            </div>
            <p className="text-xs text-[#8B95A5]">
              Vos expéditions sont gérées via Medikong Shipping. Une commission de {marginPercentage}% est appliquée sur chaque envoi.
              Les étiquettes sont générées automatiquement et le suivi est partagé avec vos acheteurs.
            </p>
            <div className="flex items-center gap-3 text-xs text-[#4A5568]">
              <span>📦 Étiquettes automatiques</span>
              <span>🔍 Suivi en temps réel</span>
              <span>💬 Support inclus</span>
            </div>
          </div>
        </VCard>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Changer de mode d'expédition
            </DialogTitle>
            <DialogDescription className="text-sm">
              Les commandes en cours continueront d'être traitées avec le mode actuel.
              Le nouveau mode s'appliquera uniquement aux nouvelles commandes.
              <br /><br />
              Voulez-vous passer en mode <strong>
                {pendingMode === "no_shipping" && "gestion manuelle"}
                {pendingMode === "own_sendcloud" && "Sendcloud personnel"}
                {pendingMode === "medikong_whitelabel" && "Medikong Shipping"}
              </strong> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <VBtn variant="outline" size="sm" onClick={() => setConfirmDialogOpen(false)}>
              Annuler
            </VBtn>
            <VBtn
              size="sm"
              onClick={confirmModeSwitch}
              disabled={updateModeMutation.isPending}
            >
              {updateModeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : null}
              Confirmer le changement
            </VBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
