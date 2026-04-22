import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Package, Truck, ShieldCheck, Check, AlertTriangle,
  ChevronLeft, ChevronRight, Loader2, Eye, EyeOff, ExternalLink,
  MapPin, Clipboard
} from "lucide-react";
import { toast } from "sonner";

/* ─── Types ─── */
type ShippingMode = "no_shipping" | "own_sendcloud" | "medikong_whitelabel";

interface CompanyForm {
  company_name: string;
  name: string;
  email: string;
  phone: string;
  vat_number: string;
}

interface AddressForm {
  label: string;
  name: string;
  company_name: string;
  address_line_1: string;
  address_line_2: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
}

interface SendcloudKeys {
  public_key: string;
  secret_key: string;
}

/* ─── Step indicator ─── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Entreprise", "Expédition", "Configuration", "Récap", "Convention"];
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 ${active ? "text-primary font-semibold" : done ? "text-primary/60" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                done ? "bg-primary border-primary text-primary-foreground" :
                active ? "border-primary text-primary bg-primary/10" :
                "border-border text-muted-foreground"
              }`}>
                {done ? <Check className="w-4 h-4" /> : step}
              </div>
              <span className="text-xs hidden sm:inline">{labels[i]}</span>
            </div>
            {i < total - 1 && <div className={`w-8 h-px ${done ? "bg-primary" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Shipping mode cards (reused from settings) ─── */
const MODES = [
  {
    id: "no_shipping" as const,
    icon: Package,
    title: "Je gère mes expéditions moi-même",
    description: "Vous gérez l'envoi en dehors de Medikong. Vous pourrez ajouter un numéro de suivi manuellement.",
    pros: ["Aucune configuration nécessaire", "Liberté totale"],
    cons: ["Pas de suivi automatique", "Pas d'étiquettes intégrées"],
  },
  {
    id: "own_sendcloud" as const,
    icon: Truck,
    title: "J'ai déjà un compte Sendcloud",
    description: "Connectez votre propre compte Sendcloud pour générer vos étiquettes et suivre vos colis.",
    pros: ["Vos tarifs transporteurs", "Facturation Sendcloud directe"],
    cons: ["Configuration initiale requise"],
  },
  {
    id: "medikong_whitelabel" as const,
    icon: ShieldCheck,
    title: "Utiliser Medikong Shipping",
    description: "Medikong s'occupe de tout : tarifs négociés, étiquettes, suivi, support. Commission de 15% par envoi.",
    pros: ["Aucune configuration transporteur", "Tarifs négociés", "Support inclus"],
    cons: ["Commission Medikong sur chaque envoi"],
  },
];

/* ─── Main component ─── */
export default function VendorOnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1 — Company
  const [company, setCompany] = useState<CompanyForm>({
    company_name: "", name: "", email: user?.email || "", phone: "", vat_number: "",
  });

  // Step 2 — Shipping mode
  const [shippingMode, setShippingMode] = useState<ShippingMode>("no_shipping");

  // Step 3 — Mode-specific
  const [address, setAddress] = useState<AddressForm>({
    label: "Entrepôt principal", name: "", company_name: "",
    address_line_1: "", address_line_2: "", house_number: "",
    postal_code: "", city: "", country: "BE", phone: "", email: "",
  });
  const [scKeys, setScKeys] = useState<SendcloudKeys>({ public_key: "", secret_key: "" });
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "fail">("idle");
  const [testing, setTesting] = useState(false);

  // Submit
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");

      // 1. Create vendor
      const slug = company.company_name
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
        || `vendor-${Date.now()}`;

      const { data: vendor, error: vendorErr } = await supabase
        .from("vendors")
        .insert({
          name: company.name || company.company_name,
          company_name: company.company_name,
          email: company.email,
          phone: company.phone,
          vat_number: company.vat_number || null,
          slug,
          auth_user_id: user.id,
          type: "real" as any,
          vendor_shipping_mode: shippingMode,
          is_active: false,
          validation_status: "pending_review",
        } as any)
        .select("id")
        .single();

      if (vendorErr) throw vendorErr;
      const vendorId = vendor.id;

      // 2. Mode-specific setup
      if (shippingMode === "own_sendcloud") {
        await supabase.from("vendor_sendcloud_credentials").insert({
          vendor_id: vendorId,
          sendcloud_public_key: scKeys.public_key,
          sendcloud_secret_key: scKeys.secret_key,
          is_connected: testResult === "success",
        } as any);
      }

      if (shippingMode === "medikong_whitelabel") {
        // Save shipping address
        await supabase.from("vendor_shipping_addresses").insert({
          vendor_id: vendorId,
          ...address,
          is_default: true,
        } as any);

        // Create Sendcloud sender address via edge function
        const { data: scResult, error: scErr } = await supabase.functions.invoke("sendcloud-api", {
          body: {
            operation: "createSenderAddress",
            payload: {
              company_name: address.company_name || company.company_name,
              contact_name: address.name || company.name,
              email: address.email || company.email,
              telephone: address.phone || company.phone,
              street: address.address_line_1,
              house_number: address.house_number,
              postal_code: address.postal_code,
              city: address.city,
              country: address.country,
            },
          },
        });

        if (scErr) {
          console.error("Sendcloud sender address creation failed:", scErr);
        } else if (scResult?.success && scResult?.data?.sender_address?.id) {
          // Store Sendcloud IDs on vendor
          await supabase.from("vendors").update({
            sendcloud_sender_address_id: String(scResult.data.sender_address.id),
          } as any).eq("id", vendorId);

          // Optionally create brand
          const { data: brandResult } = await supabase.functions.invoke("sendcloud-api", {
            body: {
              operation: "createBrand",
              payload: {
                name: company.company_name,
                color: "#1C58D9",
              },
            },
          });
          if (brandResult?.success && brandResult?.data?.brand?.id) {
            await supabase.from("vendors").update({
              sendcloud_brand_id: String(brandResult.data.brand.id),
            } as any).eq("id", vendorId);
          }
        }
      }

      return vendorId;
    },
    onSuccess: () => {
      toast.success("Inscription vendeur envoyée ! Votre compte est en cours de validation.");
      navigate("/vendor");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erreur lors de l'inscription");
    },
  });

  const testSendcloudConnection = async () => {
    setTesting(true);
    setTestResult("idle");
    try {
      const res = await supabase.functions.invoke("sendcloud-api", {
        body: {
          action: "test_connection",
          public_key: scKeys.public_key,
          secret_key: scKeys.secret_key,
        },
      });
      if (res.data?.success) {
        setTestResult("success");
        toast.success("Connexion Sendcloud vérifiée ✓");
      } else {
        setTestResult("fail");
        toast.error("Identifiants Sendcloud invalides");
      }
    } catch {
      setTestResult("fail");
      toast.error("Erreur de test de connexion");
    } finally {
      setTesting(false);
    }
  };

  // Validation
  const canProceed = (): boolean => {
    if (step === 1) return !!company.company_name && !!company.email;
    if (step === 2) return true; // mode always selected
    if (step === 3) {
      if (shippingMode === "no_shipping") return true;
      if (shippingMode === "own_sendcloud") return !!scKeys.public_key && !!scKeys.secret_key;
      if (shippingMode === "medikong_whitelabel") return !!address.address_line_1 && !!address.city && !!address.postal_code;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">Devenir vendeur MediKong</h1>
          <p className="text-sm text-muted-foreground mt-1">Complétez votre inscription en quelques minutes</p>
        </div>

        <StepIndicator current={step} total={5} />

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          {/* ─── STEP 1: Company ─── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Informations entreprise</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm font-medium">Raison sociale *</Label>
                  <Input
                    value={company.company_name}
                    onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                    placeholder="Pharmacie Dupont SPRL"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Nom du contact</Label>
                  <Input
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Email professionnel *</Label>
                  <Input
                    type="email"
                    value={company.email}
                    onChange={(e) => setCompany({ ...company, email: e.target.value })}
                    placeholder="contact@pharmacie.be"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Téléphone</Label>
                  <Input
                    value={company.phone}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    placeholder="+32 2 123 45 67"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">N° TVA</Label>
                  <Input
                    value={company.vat_number}
                    onChange={(e) => setCompany({ ...company, vat_number: e.target.value })}
                    placeholder="BE0123456789"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Shipping mode ─── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Mode d'expédition</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Choisissez comment vous souhaitez expédier vos commandes. Vous pourrez changer à tout moment.
              </p>

              <div className="grid grid-cols-1 gap-3">
                {MODES.map((mode) => {
                  const isActive = shippingMode === mode.id;
                  const Icon = mode.icon;
                  return (
                    <div
                      key={mode.id}
                      className={`relative rounded-xl border-2 p-4 transition-all cursor-pointer hover:shadow-md ${
                        isActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                      }`}
                      onClick={() => setShippingMode(mode.id)}
                    >
                      {isActive && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">{mode.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {mode.pros.map((p) => (
                              <span key={p} className="flex items-center gap-1 text-xs text-foreground/70">
                                <Check className="w-3 h-3 text-green-500" /> {p}
                              </span>
                            ))}
                            {mode.cons.map((c) => (
                              <span key={c} className="flex items-center gap-1 text-xs text-foreground/70">
                                <AlertTriangle className="w-3 h-3 text-amber-500" /> {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── STEP 3: Mode-specific setup ─── */}
          {step === 3 && (
            <div className="space-y-5">
              {shippingMode === "no_shipping" && (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h2 className="text-lg font-semibold text-foreground">Aucune configuration requise</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Vous gérez vos expéditions en dehors de Medikong. Vous pourrez ajouter un numéro de suivi manuellement pour chaque commande.
                  </p>
                </div>
              )}

              {shippingMode === "own_sendcloud" && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Truck className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Connexion Sendcloud</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Entrez vos clés API Sendcloud pour connecter votre compte.
                  </p>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Clé publique Sendcloud *</Label>
                      <Input
                        value={scKeys.public_key}
                        onChange={(e) => setScKeys({ ...scKeys, public_key: e.target.value })}
                        placeholder="Votre clé publique..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Clé secrète Sendcloud *</Label>
                      <div className="relative">
                        <Input
                          type={showSecret ? "text" : "password"}
                          value={scKeys.secret_key}
                          onChange={(e) => setScKeys({ ...scKeys, secret_key: e.target.value })}
                          placeholder="Votre clé secrète..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={testSendcloudConnection}
                      disabled={testing || !scKeys.public_key || !scKeys.secret_key}
                      className="inline-flex items-center gap-1.5 rounded-md text-xs px-4 py-2 font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {testing && <Loader2 className="w-4 h-4 animate-spin" />}
                      Tester la connexion
                    </button>

                    {testResult === "success" && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Connexion vérifiée
                      </span>
                    )}
                    {testResult === "fail" && (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Identifiants invalides
                      </span>
                    )}

                    <a
                      href="https://panel.sendcloud.sc/v2/settings/integrations/api/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto"
                    >
                      Où trouver mes clés ? <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              )}

              {shippingMode === "medikong_whitelabel" && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Adresse d'expédition</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Renseignez l'adresse depuis laquelle vos colis seront expédiés. Cette adresse sera utilisée comme expéditeur sur les étiquettes.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-sm font-medium">Nom de l'adresse</Label>
                      <Input
                        value={address.label}
                        onChange={(e) => setAddress({ ...address, label: e.target.value })}
                        placeholder="Entrepôt principal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Nom du contact</Label>
                      <Input
                        value={address.name}
                        onChange={(e) => setAddress({ ...address, name: e.target.value })}
                        placeholder="Jean Dupont"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Société</Label>
                      <Input
                        value={address.company_name}
                        onChange={(e) => setAddress({ ...address, company_name: e.target.value })}
                        placeholder="Pharmacie Dupont"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-sm font-medium">Adresse *</Label>
                      <Input
                        value={address.address_line_1}
                        onChange={(e) => setAddress({ ...address, address_line_1: e.target.value })}
                        placeholder="Rue de la Science"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Numéro</Label>
                      <Input
                        value={address.house_number}
                        onChange={(e) => setAddress({ ...address, house_number: e.target.value })}
                        placeholder="42"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Complément</Label>
                      <Input
                        value={address.address_line_2}
                        onChange={(e) => setAddress({ ...address, address_line_2: e.target.value })}
                        placeholder="Étage, bât., boîte..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Code postal *</Label>
                      <Input
                        value={address.postal_code}
                        onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                        placeholder="1000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Ville *</Label>
                      <Input
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        placeholder="Bruxelles"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Pays</Label>
                      <Select value={address.country} onValueChange={(v) => setAddress({ ...address, country: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BE">🇧🇪 Belgique</SelectItem>
                          <SelectItem value="FR">🇫🇷 France</SelectItem>
                          <SelectItem value="NL">🇳🇱 Pays-Bas</SelectItem>
                          <SelectItem value="LU">🇱🇺 Luxembourg</SelectItem>
                          <SelectItem value="DE">🇩🇪 Allemagne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Téléphone</Label>
                      <Input
                        value={address.phone}
                        onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                        placeholder="+32 2 123 45 67"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-sm font-medium">Email pour les notifications transporteur</Label>
                      <Input
                        type="email"
                        value={address.email}
                        onChange={(e) => setAddress({ ...address, email: e.target.value })}
                        placeholder="logistique@pharmacie.be"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── STEP 4: Review ─── */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Clipboard className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Récapitulatif</h2>
              </div>

              <div className="space-y-4">
                {/* Company summary */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> Entreprise
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Raison sociale:</span> <span className="font-medium text-foreground">{company.company_name}</span></div>
                    <div><span className="text-muted-foreground">Contact:</span> <span className="font-medium text-foreground">{company.name || "—"}</span></div>
                    <div><span className="text-muted-foreground">Email:</span> <span className="font-medium text-foreground">{company.email}</span></div>
                    <div><span className="text-muted-foreground">Téléphone:</span> <span className="font-medium text-foreground">{company.phone || "—"}</span></div>
                    <div><span className="text-muted-foreground">N° TVA:</span> <span className="font-medium text-foreground">{company.vat_number || "—"}</span></div>
                  </div>
                </div>

                {/* Shipping mode summary */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" /> Expédition
                  </h3>
                  <p className="text-xs text-foreground">
                    {shippingMode === "no_shipping" && "🔧 Gestion manuelle — Vous gérez l'envoi en dehors de Medikong"}
                    {shippingMode === "own_sendcloud" && "🔗 Sendcloud personnel — Votre propre compte Sendcloud"}
                    {shippingMode === "medikong_whitelabel" && "🚀 Medikong Shipping — Service clé en main avec tarifs négociés"}
                  </p>
                </div>

                {/* Mode-specific details */}
                {shippingMode === "own_sendcloud" && (
                  <div className="rounded-lg border border-border p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Connexion Sendcloud</h3>
                    <div className="text-xs space-y-1">
                      <div><span className="text-muted-foreground">Clé publique:</span> <span className="font-mono text-foreground">{scKeys.public_key.substring(0, 12)}...</span></div>
                      <div>
                        <span className="text-muted-foreground">Statut:</span>{" "}
                        {testResult === "success"
                          ? <span className="text-green-600 font-medium">✓ Vérifié</span>
                          : <span className="text-amber-600 font-medium">⚠ Non testé</span>
                        }
                      </div>
                    </div>
                  </div>
                )}

                {shippingMode === "medikong_whitelabel" && (
                  <div className="rounded-lg border border-border p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Adresse d'expédition</h3>
                    <p className="text-xs text-foreground">
                      {address.company_name || company.company_name}<br />
                      {address.address_line_1} {address.house_number}<br />
                      {address.postal_code} {address.city}, {address.country}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-primary/5 rounded-lg border border-primary/20 p-4">
                <p className="text-xs text-foreground/80">
                  En soumettant votre inscription, votre profil vendeur sera créé et soumis à validation par l'équipe MediKong.
                  Vous recevrez un email de confirmation une fois votre compte activé.
                </p>
              </div>
            </div>
          )}

          {/* ─── Navigation buttons ─── */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1.5 rounded-md text-sm px-4 py-2 font-medium border border-border text-foreground hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="inline-flex items-center gap-1.5 rounded-md text-sm px-5 py-2 font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Suivant <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md text-sm px-5 py-2 font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Soumettre mon inscription
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
