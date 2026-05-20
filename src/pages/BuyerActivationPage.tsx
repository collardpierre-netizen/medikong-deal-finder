import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Stethoscope, Pill, Building2, Layers, Store, ArrowRight, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const buyerProfiles = [
  { value: "health_pro", label: "Professionnel de santé", desc: "Médecin, kiné, dentiste, infirmier…", Icon: Stethoscope },
  { value: "pharmacist", label: "Pharmacien", desc: "Officine, pharmacie en ligne", Icon: Pill },
  { value: "care_facility", label: "Établissement de soins", desc: "Hôpital, clinique, EHPAD, MR/MRS", Icon: Building2 },
  { value: "purchasing_group", label: "Centrale d'achat / Groupement", desc: "Achats groupés, appels d'offres", Icon: Layers },
  { value: "reseller", label: "Revendeur / Distributeur", desc: "E-shop, parapharmacie, retailer", Icon: Store },
];

type VendorRow = {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  address_line1: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
};

export default function BuyerActivationPage() {
  const navigate = useNavigate();
  const { user, hasVendorAccount, hasCustomerRow, buyerStatus, verificationLoading } = useAuth();

  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<string>("");
  const [restockOptIn, setRestockOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Address override (when vendor address is incomplete)
  const [addressDraft, setAddressDraft] = useState({
    address_line1: "",
    postal_code: "",
    city: "",
    country_code: "BE",
  });
  const [addressDraftInitialized, setAddressDraftInitialized] = useState(false);

  // Redirect when activation is no longer relevant
  useEffect(() => {
    if (verificationLoading) return;
    if (!user) {
      navigate("/connexion", { replace: true });
      return;
    }
    if (hasCustomerRow || buyerStatus === "verified" || buyerStatus === "pending") {
      navigate("/compte/statut", { replace: true });
    }
  }, [verificationLoading, user, hasCustomerRow, buyerStatus, navigate]);

  // Load vendor row to pre-fill
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, email, phone, vat_number, address_line1, city, postal_code, country_code")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error("Impossible de charger vos informations vendeur");
      } else {
        setVendor(data as VendorRow | null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Pre-fill address draft from vendor row (once)
  useEffect(() => {
    if (!vendor || addressDraftInitialized) return;
    setAddressDraft({
      address_line1: (vendor.address_line1 || "").trim(),
      postal_code: (vendor.postal_code || "").trim(),
      city: (vendor.city || "").trim(),
      country_code: (vendor.country_code || "BE").trim(),
    });
    setAddressDraftInitialized(true);
  }, [vendor, addressDraftInitialized]);

  // True when the vendor row is missing one of the 3 mandatory address fields
  const addressIncomplete = useMemo(() => {
    if (!vendor) return false;
    return !vendor.address_line1?.trim() || !vendor.city?.trim() || !vendor.postal_code?.trim();
  }, [vendor]);

  // Validate the draft (used both for the "complete address" form and the final submit)
  const draftValid = useMemo(() => {
    const line1 = addressDraft.address_line1.trim();
    const pc = addressDraft.postal_code.trim();
    const city = addressDraft.city.trim();
    if (line1.length < 2 || line1.length > 200) return false;
    if (city.length < 1 || city.length > 100) return false;
    // BE/FR/LU: 4 to 10 alphanumeric chars (covers BE 4 digits, FR 5 digits, NL 6 chars)
    if (!/^[A-Za-z0-9 \-]{3,10}$/.test(pc)) return false;
    if (!/^[A-Z]{2}$/.test(addressDraft.country_code)) return false;
    return true;
  }, [addressDraft]);

  const prefill = useMemo(() => {
    if (!vendor) return null;
    return {
      company_name: vendor.company_name || vendor.name || "",
      email: vendor.email || user?.email || "",
      phone: vendor.phone || "",
      vat_number: vendor.vat_number || "",
      address_line1: addressDraft.address_line1.trim(),
      city: addressDraft.city.trim(),
      postal_code: addressDraft.postal_code.trim(),
      country_code: addressDraft.country_code.trim() || "BE",
    };
  }, [vendor, user?.email, addressDraft]);



  const handleActivate = async () => {
    if (!user || !prefill) return;
    if (!profile) {
      toast.error("Sélectionnez votre profil acheteur");
      return;
    }
    if (!draftValid) {
      toast.error("Complétez votre adresse", {
        description: "Rue, code postal et ville sont obligatoires (le « 0000 » par défaut n'est plus accepté).",
      });
      return;
    }
    setSubmitting(true);
    try {
      // Map professional profile → customer_type enum (pharmacy|hospital|clinic|lab|other).
      // DB default is 'pharmacy' (NOT NULL) — incorrect pour un vendeur devenu acheteur
      // qui n'est généralement pas une officine, donc on envoie explicitement la valeur.
      const customerTypeMap: Record<string, "pharmacy" | "hospital" | "clinic" | "lab" | "other"> = {
        pharmacist: "pharmacy",
        care_facility: "hospital", // hôpital / clinique / EHPAD / MR-MRS
        health_pro: "other",       // médecin, kiné, dentiste, infirmier
        purchasing_group: "other", // centrale d'achat
        reseller: "other",         // revendeur / distributeur
      };
      const customerType = customerTypeMap[profile] ?? "other";

      const { error: insertErr } = await supabase.from("customers").insert({
        auth_user_id: user.id,
        company_name: prefill.company_name || user.email || "Compte acheteur",
        email: prefill.email,
        phone: prefill.phone || null,
        vat_number: prefill.vat_number || null,
        country_code: prefill.country_code,
        address_line1: prefill.address_line1,
        city: prefill.city,
        postal_code: prefill.postal_code,
        customer_type: customerType,
        is_verified: false,
      });
      if (insertErr) throw insertErr;

      // Store buyer profile in user metadata (non-blocking)
      await supabase.auth
        .updateUser({ data: { onboarding_buyer_profile: profile, has_buyer_account: true } })
        .catch(() => {});

      // ReStock opt-in (non-blocking)
      if (restockOptIn) {
        await supabase
          .from("restock_buyers")
          .insert({
            auth_user_id: user.id,
            pharmacy_name: prefill.company_name || user.email || "Compte acheteur",
            email: prefill.email,
            phone: prefill.phone || null,
            city: prefill.city || null,
            verified_status: "pending",
            interests: [],
          })
          .then(({ error }) => {
            if (error) console.warn("ReStock opt-in skipped:", error.message);
          });
      }

      // Notify admins (best-effort)
      supabase.functions
        .invoke("send-transactional-email", {
          body: {
            templateName: "buyer-registration",
            recipientEmail: "admin@medikong.pro",
            idempotencyKey: `buyer-activation-${user.id}`,
            templateData: {
              companyName: prefill.company_name,
              email: prefill.email,
              phone: prefill.phone || undefined,
              country: prefill.country_code,
              vatNumber: prefill.vat_number || undefined,
              source: "vendor_buyer_activation",
            },
          },
        })
        .catch(() => {});

      toast.success("Compte acheteur activé", {
        description: "Notre équipe va vérifier vos informations sous 24-48 h.",
      });
      navigate("/compte/statut", { replace: true });
    } catch (err: any) {
      console.error("Buyer activation failed:", err);
      toast.error("Activation impossible", { description: err?.message || "Veuillez réessayer." });
    } finally {
      setSubmitting(false);
    }
  };

  if (verificationLoading || loading) {
    return (
      <Layout>
        <div className="container max-w-3xl py-10 space-y-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!hasVendorAccount) {
    return (
      <Layout>
        <div className="container max-w-3xl py-10 space-y-6">
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <div className="rounded-full bg-background/60 p-3">
                <AlertTriangle className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <CardTitle className="text-amber-900">Activation rapide indisponible</CardTitle>
                <CardDescription className="text-amber-800/80">
                  L'activation pré-remplie est réservée aux comptes vendeurs existants. Créez un profil acheteur classique pour continuer.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/onboarding?role=buyer">
                  Créer mon profil acheteur <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-3xl py-10 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" /> Activation rapide
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Activez votre compte acheteur</h1>
          <p className="text-muted-foreground mt-1">
            Vos informations vendeur sont pré-remplies. Confirmez votre profil acheteur en quelques secondes pour accéder aux Bonnes Affaires.
          </p>
        </div>

        {prefill && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations reprises de votre compte vendeur</CardTitle>
              <CardDescription>Vérifiez puis confirmez. Vous pourrez les ajuster plus tard depuis votre compte.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Raison sociale</dt>
                  <dd className="font-medium">{prefill.company_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">TVA</dt>
                  <dd className="font-medium">{prefill.vat_number || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium">{prefill.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Téléphone</dt>
                  <dd className="font-medium">{prefill.phone || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Adresse</dt>
                  <dd className="font-medium">
                    {draftValid
                      ? `${prefill.address_line1}, ${prefill.postal_code} ${prefill.city} (${prefill.country_code})`
                      : "À compléter ci-dessous"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        <Card className={addressIncomplete ? "border-amber-300 bg-amber-50/40" : undefined}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Adresse de facturation
              {addressIncomplete && (
                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                  À compléter
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {addressIncomplete
                ? "Votre compte vendeur n'a pas d'adresse postale complète. Renseignez-la ici avant d'activer (les valeurs « 0000 » par défaut ne sont plus acceptées)."
                : "Vérifiez ou corrigez l'adresse reprise de votre compte vendeur."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-6">
                <Label htmlFor="addr-line1" className="text-xs">Rue et numéro</Label>
                <Input
                  id="addr-line1"
                  maxLength={200}
                  placeholder="Rue de la Procession 23"
                  value={addressDraft.address_line1}
                  onChange={(e) => setAddressDraft((d) => ({ ...d, address_line1: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="addr-pc" className="text-xs">Code postal</Label>
                <Input
                  id="addr-pc"
                  maxLength={10}
                  placeholder="7822"
                  value={addressDraft.postal_code}
                  onChange={(e) => setAddressDraft((d) => ({ ...d, postal_code: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor="addr-city" className="text-xs">Ville</Label>
                <Input
                  id="addr-city"
                  maxLength={100}
                  placeholder="Ath"
                  value={addressDraft.city}
                  onChange={(e) => setAddressDraft((d) => ({ ...d, city: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-1">
                <Label htmlFor="addr-cc" className="text-xs">Pays</Label>
                <Input
                  id="addr-cc"
                  maxLength={2}
                  placeholder="BE"
                  value={addressDraft.country_code}
                  onChange={(e) =>
                    setAddressDraft((d) => ({ ...d, country_code: e.target.value.toUpperCase().slice(0, 2) }))
                  }
                />
              </div>
            </div>
            {!draftValid && (
              <p className="text-xs text-amber-700 mt-3">
                Renseignez une rue, un code postal (3 à 10 caractères) et une ville valides pour activer votre compte acheteur.
              </p>
            )}
          </CardContent>
        </Card>



        <Card>
          <CardHeader>
            <CardTitle className="text-base">Votre profil acheteur</CardTitle>
            <CardDescription>Sélectionnez le profil qui correspond à votre activité d'achat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {buyerProfiles.map((p) => {
              const Icon = p.Icon;
              const selected = profile === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProfile(p.value)}
                  className={`w-full text-left flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`rounded-full p-2 ${selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.label}</p>
                      {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="restock-opt-in" className="font-medium">
                Activer aussi ReStock
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Recevez les opportunités de déstockage entre pharmacies (vérification séparée requise).
              </p>
            </div>
            <Switch id="restock-opt-in" checked={restockOptIn} onCheckedChange={setRestockOptIn} />
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button variant="outline" asChild>
            <Link to="/compte/statut">Annuler</Link>
          </Button>
          <Button onClick={handleActivate} disabled={submitting || !profile}>
            {submitting ? "Activation…" : "Activer mon compte acheteur"}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Votre compte sera vérifié manuellement par notre équipe sous 24-48 h ouvrées avant l'accès aux prix HTVA et aux Bonnes Affaires.
        </p>
      </div>
    </Layout>
  );
}
