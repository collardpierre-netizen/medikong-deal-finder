import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Building2, User, ShoppingBag, Truck, Package,
  Shield, ChevronRight, ChevronLeft, Check, FileText, Globe, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── Constants ─── */
const businessTypes = [
  { id: "brand", label: "Marque / Brand", desc: "Vous créez et vendez vos propres produits", icon: Store },
  { id: "distributor", label: "Distributeur", desc: "Vous distribuez des marques tierces", icon: Package },
  { id: "wholesaler", label: "Grossiste", desc: "Vente en gros multi-marques", icon: Truck },
  { id: "retailer", label: "Détaillant / Retailer", desc: "Boutique(s) physique(s) ou en ligne", icon: ShoppingBag },
  { id: "artisan", label: "Artisan / Créateur", desc: "Créations originales et faites main", icon: Shield },
  { id: "agent", label: "Agent / Représentant", desc: "Vous représentez des marques", icon: User },
];

const countries = [
  "Belgique", "France", "Pays-Bas", "Luxembourg", "Allemagne",
  "Espagne", "Italie", "Portugal", "Royaume-Uni", "Suisse", "Autre UE", "Autre hors UE",
];

const languages = [
  { code: "fr", label: "Français" },
  { code: "nl", label: "Nederlands" },
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

const revenueOptions = ["< 50k€", "50k-250k€", "250k-1M€", "1M-5M€", "> 5M€", "Préfère ne pas répondre"];

const productCategories = [
  "Prêt-à-porter Femme", "Homme", "Enfant", "Chaussures", "Maroquinerie & Sacs",
  "Bijoux & Montres", "Accessoires Mode", "Lingerie & Maillots", "Soins Visage",
  "Soins Corps", "Maquillage", "Parfumerie", "Soins Capillaires",
  "Cosmétiques Bio & Naturels", "Soins pour Hommes",
];

const skuOptions = ["< 50", "50-200", "200-1000", "1000-5000", "> 5000"];
const eanOptions = ["Oui, tous", "La plupart", "Quelques-uns", "Non"];
const salesChannels = [
  "Boutique(s) physique(s)", "E-commerce propre", "Amazon", "Zalando",
  "Bol.com", "Veepee", "Showroomprivé", "Autres marketplaces", "Wholesale / B2B", "Réseaux sociaux",
];

const fulfillmentOptions = [
  { id: "self", label: "Expédition par nos soins", desc: "Vous gérez l'emballage et l'envoi", icon: Package },
  { id: "medikong", label: "Fulfillment MediKong", desc: "MediKong stocke et expédie pour vous", icon: Store },
  { id: "hybrid", label: "Hybride", desc: "Mix des deux selon les commandes", icon: Truck },
  { id: "undecided", label: "Pas encore décidé", desc: "Vous choisirez plus tard", icon: FileText },
];

const leadTimeOptions = ["24h", "48h", "3-5 jours", "1-2 semaines", "Variable"];
const referralOptions = ["Google", "Réseaux sociaux", "Bouche à oreille", "Salon", "Presse", "Recommandation", "Autre"];

/* ─── Types ─── */
interface FormData {
  businessType: string;
  preferredLanguage: string;
  firstName: string; lastName: string; email: string; phone: string; jobTitle: string;
  companyName: string; country: string; city: string; vatNumber: string; website: string;
  annualRevenue: string; companyDescription: string;
  productCategories: string[]; skuCount: string; brands: string; hasEAN: string; salesChannels: string[];
  fulfillment: string; shippingCountries: string[]; leadTime: string; moq: string;
  referralSource: string; notes: string; acceptTerms: boolean;
}

const initialData: FormData = {
  businessType: "", preferredLanguage: "fr",
  firstName: "", lastName: "", email: "", phone: "", jobTitle: "",
  companyName: "", country: "", city: "", vatNumber: "", website: "",
  annualRevenue: "", companyDescription: "",
  productCategories: [], skuCount: "", brands: "", hasEAN: "", salesChannels: [],
  fulfillment: "", shippingCountries: [], leadTime: "", moq: "",
  referralSource: "", notes: "", acceptTerms: false,
};

/* ─── Helpers ─── */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toggleArray(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

/* ─── Sub-components ─── */
function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <span className="inline-block text-xs font-semibold text-mk-blue bg-[#EFF6FF] px-2.5 py-1 rounded-full mb-3">
        Étape {step} sur 5
      </span>
      <h2 className="text-2xl font-bold text-mk-navy mb-1">{title}</h2>
      <p className="text-sm text-mk-sec">{subtitle}</p>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="text-[11px] text-mk-red mt-0.5 block">{msg}</span>;
}

function InputField({
  label, required, error, ...props
}: { label: string; required?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-[13px] text-mk-sec mb-1 block">{label}{required && <span className="text-mk-red ml-0.5">*</span>}</label>
      <input
        {...props}
        className={`w-full border rounded-md px-3 py-2.5 text-[13px] placeholder:text-mk-ter focus:outline-none focus:border-mk-blue transition-colors ${error ? "border-mk-red bg-[#FEF2F2]" : "border-mk-line"}`}
      />
      <FieldError msg={error} />
    </div>
  );
}

function SelectField({
  label, required, options, error, ...props
}: { label: string; required?: boolean; options: string[]; error?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="text-[13px] text-mk-sec mb-1 block">{label}{required && <span className="text-mk-red ml-0.5">*</span>}</label>
      <select
        {...props}
        className={`w-full border rounded-md px-3 py-2.5 text-[13px] focus:outline-none focus:border-mk-blue transition-colors ${error ? "border-mk-red bg-[#FEF2F2]" : "border-mk-line"}`}
      >
        <option value="">Sélectionner...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <FieldError msg={error} />
    </div>
  );
}

/* ─── Page ─── */
export default function SellerOnboardingPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof FormData, val: FormData[keyof FormData]) =>
    setData(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const progress = step === 0 ? 0 : submitted ? 100 : (step / 5) * 100;

  /* Validation */
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1 && !data.businessType) e.businessType = "Requis";
    if (step === 2) {
      if (!data.firstName.trim()) e.firstName = "Requis";
      if (!data.lastName.trim()) e.lastName = "Requis";
      if (!data.email.trim()) e.email = "Requis";
      else if (!emailRegex.test(data.email)) e.email = "Email invalide";
      if (!data.phone.trim()) e.phone = "Requis";
    }
    if (step === 3) {
      if (!data.companyName.trim()) e.companyName = "Requis";
      if (!data.country) e.country = "Requis";
      if (!data.city.trim()) e.city = "Requis";
    }
    if (step === 5 && !data.acceptTerms) e.acceptTerms = "Requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) setStep(s => s + 1);
  };
  const prev = () => { setErrors({}); setStep(s => s - 1); };
  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const slug = data.companyName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const { error } = await supabase.from("vendors").insert({
        name: data.companyName.trim(),
        slug,
        company_name: data.companyName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim() || null,
        vat_number: data.vatNumber.trim() || null,
        city: data.city.trim(),
        country_code: data.country === "Belgique" ? "BE" : data.country === "France" ? "FR" : data.country === "Pays-Bas" ? "NL" : data.country === "Luxembourg" ? "LU" : data.country === "Allemagne" ? "DE" : "BE",
        type: "real" as any,
        is_active: false,
        is_verified: false,
        business_type: data.businessType,
        preferred_language: data.preferredLanguage,
        description: [
          data.companyDescription,
          `CA: ${data.annualRevenue}`,
          `Canaux: ${data.salesChannels.join(", ")}`,
          `Fulfillment: ${data.fulfillment}`,
          `Délai: ${data.leadTime}`,
          `MOQ: ${data.moq}`,
          `Source: ${data.referralSource}`,
          data.notes ? `Notes: ${data.notes}` : "",
        ].filter(Boolean).join(" | "),
        validation_status: "pending_review" as any,
      } as any);

      if (error) throw error;

      // Notify admin via edge function (fire & forget)
      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "vendor-application",
          recipientEmail: "admin@medikong.pro",
          idempotencyKey: `vendor-app-${data.email}-${Date.now()}`,
          templateData: {
            companyName: data.companyName,
            email: data.email,
            phone: data.phone,
            businessType: data.businessType,
            country: data.country,
          },
        },
      }).catch(() => {});

      setSubmitted(true);
      setStep(6);
    } catch (err: any) {
      toast.error("Erreur lors de l'envoi : " + (err.message || "Réessayez"));
    } finally {
      setSubmitting(false);
    }
  };

  const canContinue = () => {
    if (step === 1) return !!data.businessType;
    if (step === 5) return data.acceptTerms;
    return true;
  };

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-mk-alt flex flex-col">
      {/* Progress bar */}
      {step > 0 && !submitted && (
        <div className="h-[3px] bg-mk-alt w-full sticky top-0 z-50">
          <div
            className="h-full bg-mk-blue transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-[640px]">
          {/* Card */}
          <div
            ref={scrollRef}
            className="bg-white border border-mk-line rounded-lg px-6 py-8 md:px-9 md:py-8 max-h-[75vh] overflow-y-auto"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                {/* ─── WELCOME ─── */}
                {step === 0 && (
                  <div className="text-center py-6">
                    <Link to="/" className="inline-flex items-center mb-6">
                      <span className="text-mk-navy font-bold text-[28px]">MediKong</span>
                      <span className="text-mk-blue font-bold text-[28px]">.pro</span>
                    </Link>
                    <div className="w-16 h-16 bg-mk-navy rounded-lg flex items-center justify-center mx-auto mb-5">
                      <Store size={28} className="text-white" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-[28px] font-bold text-mk-navy mb-2">Devenez vendeur partenaire</h1>
                    <p className="text-sm text-mk-sec mb-1 max-w-md mx-auto">
                      Rejoignez MediKong.pro et accédez à des milliers de clients B2B et B2C en Mode & Beauté.
                    </p>
                    <p className="text-xs text-mk-ter mb-8">
                      Environ 3 minutes. Les documents complémentaires seront collectés après validation.
                    </p>
                    <button
                      onClick={() => setStep(1)}
                      className="bg-mk-navy text-white font-bold text-[13px] px-6 py-3 rounded-md inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
                    >
                      Commencer l'inscription <ChevronRight size={16} strokeWidth={1.5} />
                    </button>
                    <p className="text-[11px] text-mk-ter mt-4">Aucun document requis à cette étape</p>
                  </div>
                )}

                {/* ─── STEP 1: Business Type ─── */}
                {step === 1 && (
                  <div>
                    <StepHeader step={1} title="Type d'activité" subtitle="Quel est votre modèle de vente principal ?" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {businessTypes.map(bt => {
                        const active = data.businessType === bt.id;
                        const Icon = bt.icon;
                        return (
                          <button
                            key={bt.id}
                            onClick={() => set("businessType", bt.id)}
                            className={`text-left p-4 rounded-lg border-2 transition-colors ${active ? "border-mk-blue bg-[#EFF6FF]" : "border-mk-line hover:border-mk-lb"}`}
                          >
                            <div className="flex items-start gap-3">
                              <Icon size={20} strokeWidth={1.5} className={active ? "text-mk-blue" : "text-mk-sec"} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-[13px] font-bold ${active ? "text-mk-blue" : "text-mk-text"}`}>{bt.label}</div>
                                <div className="text-xs text-mk-ter">{bt.desc}</div>
                              </div>
                              {active && <Check size={16} className="text-mk-blue shrink-0 mt-0.5" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ─── STEP 2: Contact ─── */}
                {step === 2 && (
                  <div>
                    <StepHeader step={2} title="Coordonnées" subtitle="Vos informations de contact professionnel" />
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Prénom" required value={data.firstName} onChange={e => set("firstName", e.target.value)} error={errors.firstName} />
                        <InputField label="Nom" required value={data.lastName} onChange={e => set("lastName", e.target.value)} error={errors.lastName} />
                      </div>
                      <InputField label="Email professionnel" required type="email" value={data.email} onChange={e => set("email", e.target.value)} error={errors.email} />
                      <InputField label="Téléphone" required type="tel" placeholder="+32 470 123 456" value={data.phone} onChange={e => set("phone", e.target.value)} error={errors.phone} />
                      <div>
                        <label className="text-[13px] text-mk-sec mb-2 block">Langue préférée <span className="text-mk-red ml-0.5">*</span></label>
                        <div className="flex gap-2">
                          {languages.map(l => {
                            const active = data.preferredLanguage === l.code;
                            return (
                              <button key={l.code} onClick={() => set("preferredLanguage", l.code)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-medium border-2 transition-colors ${active ? "border-mk-blue bg-[#EFF6FF] text-mk-blue" : "border-mk-line text-mk-sec hover:border-mk-lb"}`}>
                                <Globe size={14} /> {l.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <InputField label="Fonction / Rôle" value={data.jobTitle} onChange={e => set("jobTitle", e.target.value)} placeholder="Ex: Directeur commercial" />
                    </div>
                  </div>
                )}

                {/* ─── STEP 3: Company ─── */}
                {step === 3 && (
                  <div>
                    <StepHeader step={3} title="Entreprise" subtitle="Informations sur votre société" />
                    <div className="space-y-4">
                      <InputField label="Nom de l'entreprise" required value={data.companyName} onChange={e => set("companyName", e.target.value)} error={errors.companyName} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SelectField label="Pays du siège" required options={countries} value={data.country} onChange={e => set("country", e.target.value)} error={errors.country} />
                        <InputField label="Ville" required value={data.city} onChange={e => set("city", e.target.value)} error={errors.city} />
                      </div>
                      <InputField label="Numéro de TVA" placeholder="BE0123.456.789" value={data.vatNumber} onChange={e => set("vatNumber", e.target.value)} />
                      <InputField label="Site web / réseaux sociaux" placeholder="https://" value={data.website} onChange={e => set("website", e.target.value)} />
                      <SelectField label="Chiffre d'affaires annuel estimé" options={revenueOptions} value={data.annualRevenue} onChange={e => set("annualRevenue", e.target.value)} />
                      <div>
                        <label className="text-[13px] text-mk-sec mb-1 block">Description de l'activité</label>
                        <textarea
                          maxLength={500}
                          value={data.companyDescription}
                          onChange={e => set("companyDescription", e.target.value)}
                          rows={3}
                          className="w-full border border-mk-line rounded-md px-3 py-2.5 text-[13px] placeholder:text-mk-ter focus:outline-none focus:border-mk-blue resize-none"
                          placeholder="Décrivez brièvement votre activité..."
                        />
                        <span className="text-[11px] text-mk-ter">{data.companyDescription.length}/500</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 4: Products ─── */}
                {step === 4 && (
                  <div>
                    <StepHeader step={4} title="Produits" subtitle="Parlez-nous de votre catalogue" />
                    <div className="space-y-5">
                      <div>
                        <label className="text-[13px] text-mk-sec mb-2 block">Catégories de produits</label>
                        <div className="flex flex-wrap gap-2">
                          {productCategories.map(cat => {
                            const active = data.productCategories.includes(cat);
                            return (
                              <button
                                key={cat}
                                onClick={() => set("productCategories", toggleArray(data.productCategories, cat))}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1 ${active ? "bg-[#EFF6FF] border-mk-blue text-mk-blue" : "bg-white border-mk-line text-mk-sec"}`}
                              >
                                {active && <Check size={12} />} {cat}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <SelectField label="Nombre de SKUs" options={skuOptions} value={data.skuCount} onChange={e => set("skuCount", e.target.value)} />
                      <InputField label="Marques principales" placeholder="Ex: Nike, Zara, Chanel..." value={data.brands} onChange={e => set("brands", e.target.value)} />
                      <div>
                        <label className="text-[13px] text-mk-sec mb-2 block">Codes EAN/GTIN disponibles ?</label>
                        <div className="flex flex-wrap gap-2">
                          {eanOptions.map(opt => {
                            const active = data.hasEAN === opt;
                            return (
                              <button
                                key={opt}
                                onClick={() => set("hasEAN", opt)}
                                className={`px-3.5 py-2 rounded-md text-xs font-medium border transition-colors ${active ? "bg-[#EFF6FF] border-mk-blue text-mk-blue" : "bg-white border-mk-line text-mk-sec"}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-[13px] text-mk-sec mb-2 block">Canaux de vente actuels</label>
                        <div className="flex flex-wrap gap-2">
                          {salesChannels.map(ch => {
                            const active = data.salesChannels.includes(ch);
                            return (
                              <button
                                key={ch}
                                onClick={() => set("salesChannels", toggleArray(data.salesChannels, ch))}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? "bg-mk-navy border-mk-navy text-white" : "bg-white border-mk-line text-mk-sec"}`}
                              >
                                {ch}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 5: Logistics ─── */}
                {step === 5 && (
                  <div>
                    <StepHeader step={5} title="Logistique & Préférences" subtitle="Comment souhaitez-vous expédier ?" />
                    <div className="space-y-5">
                      <div>
                        <label className="text-[13px] text-mk-sec mb-2 block">Mode d'expédition</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {fulfillmentOptions.map(fo => {
                            const active = data.fulfillment === fo.id;
                            const Icon = fo.icon;
                            return (
                              <button
                                key={fo.id}
                                onClick={() => set("fulfillment", fo.id)}
                                className={`text-left p-4 rounded-lg border-2 transition-colors ${active ? "border-mk-blue bg-[#EFF6FF]" : "border-mk-line hover:border-mk-lb"}`}
                              >
                                <div className="flex items-start gap-3">
                                  <Icon size={20} strokeWidth={1.5} className={active ? "text-mk-blue" : "text-mk-sec"} />
                                  <div>
                                    <div className={`text-[13px] font-bold ${active ? "text-mk-blue" : "text-mk-text"}`}>{fo.label}</div>
                                    <div className="text-xs text-mk-ter">{fo.desc}</div>
                                  </div>
                                  {active && <Check size={16} className="text-mk-blue shrink-0 mt-0.5" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-[13px] text-mk-sec mb-2 block">Pays de livraison</label>
                        <div className="flex flex-wrap gap-2">
                          {countries.filter(c => !c.startsWith("Autre")).map(c => {
                            const active = data.shippingCountries.includes(c);
                            return (
                              <button
                                key={c}
                                onClick={() => set("shippingCountries", toggleArray(data.shippingCountries, c))}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? "bg-[#F0FDF4] border-mk-green text-mk-green" : "bg-white border-mk-line text-mk-sec"}`}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <SelectField label="Délai d'expédition" options={leadTimeOptions} value={data.leadTime} onChange={e => set("leadTime", e.target.value)} />
                      <InputField label="MOQ B2B (commande minimum)" placeholder="Ex: 10 pièces" value={data.moq} onChange={e => set("moq", e.target.value)} />
                      <SelectField label="Comment avez-vous connu MediKong ?" options={referralOptions} value={data.referralSource} onChange={e => set("referralSource", e.target.value)} />
                      <div>
                        <label className="text-[13px] text-mk-sec mb-1 block">Commentaires</label>
                        <textarea
                          maxLength={1000}
                          value={data.notes}
                          onChange={e => set("notes", e.target.value)}
                          rows={3}
                          className="w-full border border-mk-line rounded-md px-3 py-2.5 text-[13px] placeholder:text-mk-ter focus:outline-none focus:border-mk-blue resize-none"
                          placeholder="Informations complémentaires..."
                        />
                        <span className="text-[11px] text-mk-ter">{data.notes.length}/1000</span>
                      </div>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={data.acceptTerms}
                          onChange={e => set("acceptTerms", e.target.checked)}
                          className="mt-0.5 rounded border-mk-line"
                        />
                        <span className="text-xs text-mk-sec leading-relaxed">
                          J'accepte les <span className="text-mk-blue underline">conditions générales</span> et la{" "}
                          <span className="text-mk-blue underline">politique de confidentialité</span>
                          <br />
                          <span className="text-[11px] text-mk-ter">RGPD & FAGG/AFMPS — Balooh SRL — BE 1005.771.323</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* ─── CONFIRMATION ─── */}
                {step === 6 && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-mk-green rounded-full flex items-center justify-center mx-auto mb-5">
                      <Check size={28} className="text-white" strokeWidth={2} />
                    </div>
                    <h2 className="text-2xl font-bold text-mk-navy mb-2">Candidature envoyée !</h2>
                    <p className="text-sm text-mk-sec mb-6">
                      Merci {data.firstName} ! Notre équipe examine votre candidature et reviendra vers vous sous <strong>48h ouvrées</strong>.
                    </p>
                    <div className="bg-[#EFF6FF] rounded-lg p-5 text-left mb-6">
                      <p className="text-[13px] font-bold text-mk-navy mb-3">Prochaines étapes :</p>
                      {[
                        "Validation de votre candidature par notre équipe",
                        "Collecte des documents complémentaires (RIB, K-bis...)",
                        "Activation de votre espace vendeur et import catalogue",
                      ].map((s, i) => (
                        <div key={i} className="flex items-start gap-3 mb-2.5 last:mb-0">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-[#BFDBFE] text-mk-blue text-xs font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="text-[13px] text-mk-sec">{s}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-mk-ter mb-6">Un email de confirmation a été envoyé à <strong>{data.email}</strong></p>
                    <Link to="/" className="inline-block bg-mk-navy text-white font-bold text-[13px] px-6 py-3 rounded-md hover:opacity-90 transition-opacity">
                      Retour à l'accueil
                    </Link>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          {step >= 1 && step <= 5 && (
            <div className="flex items-center justify-between mt-5">
              <button onClick={prev} className="text-[13px] font-semibold text-mk-sec flex items-center gap-1 hover:text-mk-text transition-colors">
                <ChevronLeft size={16} strokeWidth={1.5} /> Retour
              </button>
              {step < 5 ? (
                <button
                  onClick={next}
                  disabled={!canContinue()}
                  className={`text-[13px] font-bold px-6 py-3 rounded-md transition-opacity inline-flex items-center gap-2 ${canContinue() ? "bg-mk-navy text-white hover:opacity-90" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-default"}`}
                >
                  Continuer <ChevronRight size={16} strokeWidth={1.5} />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!data.acceptTerms || submitting}
                  className={`text-[13px] font-bold px-6 py-3 rounded-md transition-opacity inline-flex items-center gap-2 ${data.acceptTerms && !submitting ? "bg-mk-green text-white hover:opacity-90" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-default"}`}
                >
                  {submitting ? <><Loader2 size={14} className="animate-spin" /> Envoi...</> : "Soumettre ma candidature"}
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-8 text-[11px] text-mk-ter">
            RGPD · Balooh SRL · TVA BE 1005.771.323 · 23 rue de la Procession, B-7822 Ath
            <br />
            <a href="mailto:partners@medikong.pro" className="text-mk-blue">partners@medikong.pro</a>
          </div>
        </div>
      </div>
    </div>
  );
}
