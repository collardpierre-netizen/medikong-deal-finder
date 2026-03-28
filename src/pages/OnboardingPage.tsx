import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingBag, Briefcase, User, Stethoscope, Pill, Building2, Layers, Store,
  ChevronLeft, ChevronUp, ChevronDown, Lock, Eye, EyeOff, Check, ArrowRight,
  Clock, Loader2, Package, Truck, Shield, FileText
} from "lucide-react";

/* ─── Design tokens ─── */
const S = {
  bg: "#F1F5F9", card: "#FFFFFF", text: "#1D2530", sec: "#616B7C", ter: "#8B95A5",
  blue: "#1B5BDA", navy: "#1E293B", green: "#059669", red: "#EF4343",
  amber: "#F59E0B", pink: "#E70866", purple: "#7C3AED",
  line: "#E2E8F0", lb: "#CBD5E1",
  blueBg: "#EFF6FF", greenBg: "#F0FDF4", redBg: "#FEF2F2", badgeBg: "#BFDBFE",
  radius: 10, radiusSm: 6,
};

/* ─── Buyer profile cards ─── */
const buyerProfileCards = [
  { value: "health_pro", label: "Professionnel de santé", desc: "Médecin, kiné, dentiste, infirmier...", Icon: Stethoscope },
  { value: "pharmacist", label: "Pharmacien", desc: "Officine, pharmacie en ligne", Icon: Pill },
  { value: "care_facility", label: "Établissement de soins", desc: "Hôpital, clinique, EHPAD, MR/MRS", Icon: Building2 },
  { value: "purchasing_group", label: "Centrale d'achat / Groupement", desc: "Achats groupés, volumes, appels d'offres", Icon: Layers },
  { value: "reseller", label: "Revendeur / Distributeur", desc: "E-shop, parapharmacie, retailer", Icon: Store },
];

/* ─── Seller business types ─── */
const sellerBusinessTypes = [
  { id: "brand", label: "Marque / Brand", desc: "Vous créez et vendez vos propres produits", Icon: Store },
  { id: "distributor", label: "Distributeur", desc: "Vous distribuez des marques tierces", Icon: Package },
  { id: "wholesaler", label: "Grossiste", desc: "Vente en gros multi-marques", Icon: Truck },
  { id: "retailer", label: "Détaillant / Retailer", desc: "Boutique(s) physique(s) ou en ligne", Icon: ShoppingBag },
  { id: "artisan", label: "Artisan / Créateur", desc: "Créations originales et faites main", Icon: Shield },
  { id: "agent", label: "Agent / Représentant", desc: "Vous représentez des marques", Icon: User },
];

/* ─── Interests ─── */
const allInterests = [
  "Dispositifs médicaux", "Équipements de diagnostic", "Consommables médicaux",
  "Pharmacie & Médicaments", "Parapharmacie", "Compléments alimentaires",
  "Hygiène & Désinfection", "Matériel de rééducation", "Orthopédie & Prothèses",
  "Optique & Audiologie", "Soins dentaires", "Mobilier médical",
  "Vêtements professionnels", "Solutions digitales santé",
];

/* ─── Seller product categories ─── */
const sellerCategories = [
  "Dispositifs médicaux", "Consommables", "EPI & Protection", "Diagnostic",
  "Pharmacie", "Parapharmacie", "Hygiène & Désinfection", "Rééducation",
  "Orthopédie", "Mobilier médical", "Instruments chirurgicaux", "Autre",
];

const countries = ["Belgique", "France", "Pays-Bas", "Luxembourg", "Allemagne"];
const memberCounts = ["< 10", "10-50", "50-200", "> 200"];
const revenueOptions = ["< 50k€", "50k-250k€", "250k-1M€", "1M-5M€", "> 5M€"];
const skuOptions = ["< 50", "50-200", "200-1000", "1000-5000", "> 5000"];
const fulfillmentOptions = [
  { id: "self", label: "Expédition par nos soins" },
  { id: "medikong", label: "Fulfillment MediKong" },
  { id: "hybrid", label: "Hybride" },
  { id: "undecided", label: "Pas encore décidé" },
];
const leadTimeOptions = ["24h", "48h", "3-5 jours", "1-2 semaines"];

/* ─── Logo ─── */
import logoLight from "@/assets/logo-horizontal.png";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";
const Logo = ({ white = false, size = 22 }: { white?: boolean; size?: number }) => (
  <img
    src={white ? logoLight : logoDark}
    alt="MediKong.pro"
    style={{ height: size + 20, filter: white ? "brightness(1.15)" : "none" }}
  />
);

/* ─── Reusable UI ─── */
const KbdHint = () => (
  <div className="hidden md:flex items-center justify-center gap-1.5 mt-3 tf-enter-pulse">
    <kbd style={{ padding: "2px 8px", border: `1px solid ${S.line}`, borderRadius: 4, background: "#fff", fontSize: 11, fontWeight: 600, color: S.sec, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
      Entrée ↵
    </kbd>
  </div>
);

const Cta = ({ children, onClick, disabled, variant = "navy", icon: Icon, loading }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "navy" | "green" | "secondary"; icon?: React.ElementType; loading?: boolean;
}) => {
  const bg = variant === "green" ? S.green : variant === "secondary" ? "#fff" : S.navy;
  const color = variant === "secondary" ? S.text : "#fff";
  const border = variant === "secondary" ? `1px solid ${S.line}` : "none";
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{
        width: "100%", padding: "12px 24px", borderRadius: S.radiusSm, fontWeight: 700,
        fontSize: 14, background: disabled ? "#E5E7EB" : bg, color: disabled ? "#9CA3AF" : color,
        border, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 8, transition: "all .2s",
      }}
    >
      {loading ? <Loader2 size={16} className="tf-spin" /> : Icon && <Icon size={16} />}
      {children}
    </button>
  );
};

const BackLink = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: S.sec, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
    <ChevronLeft size={14} /> Retour
  </button>
);

const TfInput = ({ value, onChange, placeholder, type = "text", error, autoFocus, style: extraStyle, rightIcon }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
  error?: string; autoFocus?: boolean; style?: React.CSSProperties; rightIcon?: React.ReactNode;
}) => (
  <div style={{ position: "relative", width: "100%" }}>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
      style={{
        width: "100%", padding: "10px 12px", paddingRight: rightIcon ? 40 : 12,
        border: `1px solid ${error ? S.red : S.line}`, borderRadius: S.radiusSm,
        fontSize: 13, background: error ? S.redBg : "#fff", outline: "none",
        color: S.text, fontFamily: "'DM Sans', sans-serif", ...extraStyle,
      }}
      onFocus={e => { if (!error) e.target.style.borderColor = S.blue; }}
      onBlur={e => { if (!error) e.target.style.borderColor = S.line; }}
    />
    {rightIcon && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>{rightIcon}</div>}
    {error && <div style={{ fontSize: 11, color: S.red, marginTop: 4 }}>{error}</div>}
  </div>
);

const TfSelect = ({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${S.line}`, borderRadius: S.radiusSm, fontSize: 13, color: value ? S.text : S.lb, background: "#fff", fontFamily: "'DM Sans', sans-serif", outline: "none" }}
  >
    <option value="" disabled>{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [animClass, setAnimClass] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);

  /* ─── Role ─── */
  const [role, setRole] = useState<"buyer" | "seller" | "">("");

  /* ─── Shared state ─── */
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState(false);
  const [otpShake, setOtpShake] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(59);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [country, setCountry] = useState("Belgique");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  /* ─── Buyer-specific ─── */
  const [buyerProfile, setBuyerProfile] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [groupMemberCount, setGroupMemberCount] = useState("");
  const [resellerWebsite, setResellerWebsite] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  /* ─── Seller-specific ─── */
  const [businessType, setBusinessType] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [website, setWebsite] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [sellerCats, setSellerCats] = useState<string[]>([]);
  const [skuCount, setSkuCount] = useState("");
  const [brands, setBrands] = useState("");
  const [fulfillment, setFulfillment] = useState("");
  const [leadTime, setLeadTime] = useState("");

  /* ─── Testimonials from DB ─── */
  const { data: allTestimonials = [] } = useQuery({
    queryKey: ["onboarding-testimonials"],
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_testimonials").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const testimonials = allTestimonials.filter(t => !role || t.role_visibility === role || t.role_visibility === "both");
  const fallbackTestimonials = [
    { gradient: "linear-gradient(135deg, #1a365d, #2d3748, #1a202c)", quote: "MediKong a transformé nos achats médicaux.", name: "Équipe MediKong", title: "Marketplace B2B", photo_url: null },
  ];
  const activeTestimonials = testimonials.length > 0 ? testimonials : fallbackTestimonials;

  const [tIdx, setTIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTIdx(p => (p + 1) % activeTestimonials.length), 8000);
    return () => clearInterval(iv);
  }, [activeTestimonials.length]);
  useEffect(() => { setTIdx(0); }, [role]);

  /* ─── OTP timer ─── */
  const otpStep = role === "buyer" ? 2.5 : 12.5;
  useEffect(() => {
    if (step !== otpStep) return;
    setOtpTimer(59);
    const iv = setInterval(() => setOtpTimer(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [step, otpStep]);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* ─── Step sequences ─── */
  // Buyer: 0(role) → 1(profile) → 2(email) → 2.5(otp) → 3(name) → 4(company) → 5(interests) → 6(password) → 7(done)
  // Seller: 0(role) → 11(businessType) → 12(email) → 12.5(otp) → 13(contact) → 14(company) → 15(products) → 16(logistics) → 17(password) → 18(done)
  const getSteps = useCallback(() => {
    if (role === "buyer") return [0, 1, 2, 2.5, 3, 4, 5, 6, 7];
    if (role === "seller") return [0, 11, 12, 12.5, 13, 14, 15, 16, 17, 18];
    return [0];
  }, [role]);

  const stepsList = getSteps();
  const currentIdx = stepsList.indexOf(step);

  /* ─── Navigation ─── */
  const goTo = useCallback((target: number, direction: "up" | "down") => {
    if (transitioning) return;
    setTransitioning(true);
    setDir(direction);
    setAnimClass(direction === "up" ? "tf-slide-up-out" : "tf-slide-down-out");
    setTimeout(() => {
      setStep(target);
      setAnimClass(direction === "up" ? "tf-slide-up-in" : "tf-slide-down-in");
      setTimeout(() => { setAnimClass(""); setTransitioning(false); }, 500);
    }, 300);
  }, [transitioning]);

  const goNext = useCallback(() => {
    const idx = stepsList.indexOf(step);
    if (idx < stepsList.length - 1) goTo(stepsList[idx + 1], "up");
  }, [step, stepsList, goTo]);

  const goBack = useCallback(() => {
    const idx = stepsList.indexOf(step);
    if (idx > 0) goTo(stepsList[idx - 1], "down");
  }, [step, stepsList, goTo]);

  /* ─── Validation ─── */
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);
  const emailError = emailTouched && email && !isEmailValid ? "Adresse email invalide" : "";

  const pwStrength = (() => { let s = 0; if (password.length >= 8) s++; if (/[A-Z]/.test(password)) s++; if (/[0-9]/.test(password)) s++; if (/[^A-Za-z0-9]/.test(password)) s++; return s; })();
  const pwLabels = ["", "Faible", "Moyen", "Fort", "Très fort"];
  const pwColors = ["", S.red, S.amber, S.blue, S.green];
  const pwMatch = password && passwordConfirm && password !== passwordConfirm;
  const isPasswordValid = password.length >= 8 && password === passwordConfirm && acceptTerms;

  const proIdPlaceholder = buyerProfile === "health_pro" ? "Ex : 1-12345-67-890" : buyerProfile === "pharmacist" ? "Ex : APB 1234" : "FAGG/AFMPS (optionnel)";
  const proIdRequired = buyerProfile === "health_pro" || buyerProfile === "pharmacist";
  const isCompanyValid = companyName && vatNumber && country && city && (
    buyerProfile === "purchasing_group" ? !!groupMemberCount :
    buyerProfile === "reseller" ? true :
    proIdRequired ? !!professionalId : true
  );

  /* ─── OTP handlers ─── */
  const handleSendOtp = () => { if (!isEmailValid) return; setSendingOtp(true); setTimeout(() => { setSendingOtp(false); goNext(); }, 1000); };
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const nd = [...otpDigits]; nd[idx] = val; setOtpDigits(nd); setOtpError(false);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (nd.every(d => d)) {
      if (nd.join("") === "123456") { setOtpVerified(true); setTimeout(() => goNext(), 400); }
      else { setOtpError(true); setOtpShake(true); setTimeout(() => setOtpShake(false), 400); }
    }
  };
  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => { if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) otpRefs.current[idx - 1]?.focus(); };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      e.preventDefault(); setOtpDigits(text.split("")); otpRefs.current[5]?.focus();
      if (text === "123456") { setOtpVerified(true); setTimeout(() => goNext(), 400); }
      else { setOtpError(true); setOtpShake(true); setTimeout(() => setOtpShake(false), 400); }
    }
  };

  /* ─── Submit ─── */
  const handleSubmit = () => {
    if (!isPasswordValid) return;
    console.log("Onboarding data:", { role, email, firstName, lastName, phone, companyName, vatNumber, country, city, buyerProfile, businessType, interests, sellerCats, fulfillment });
    goNext();
  };

  /* ─── OTP Screen (reusable) ─── */
  const renderOtpScreen = () => (
    <div style={{ textAlign: "center" }}>
      <BackLink onClick={goBack} />
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: S.blueBg, border: `2px solid ${S.blue}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Lock size={24} color={S.blue} />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Vérifiez votre email</h1>
      <p style={{ fontSize: 13, color: S.sec, marginBottom: 24 }}>Un code à 6 chiffres a été envoyé à <strong>{email}</strong></p>
      <div className={otpShake ? "tf-shake" : ""} style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }} onPaste={handleOtpPaste}>
        {otpDigits.map((d, i) => (
          <input key={i} ref={el => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)} autoFocus={i === 0}
            style={{
              width: 48, height: 56, border: `${d ? "2px" : "1px"} solid ${otpError ? S.red : d ? S.green : S.line}`,
              borderRadius: S.radius, fontSize: 24, fontWeight: 700, textAlign: "center",
              background: otpError ? S.redBg : d ? S.greenBg : "#fff", outline: "none", fontFamily: "'DM Sans', sans-serif",
            }}
            onFocus={e => { if (!otpError && !d) e.target.style.borderColor = S.blue; e.target.style.borderWidth = "2px"; e.target.style.background = S.blueBg; }}
            onBlur={e => { if (!d) { e.target.style.borderColor = S.line; e.target.style.borderWidth = "1px"; e.target.style.background = "#fff"; } }}
          />
        ))}
      </div>
      {otpError && <p style={{ fontSize: 12, color: S.red, marginBottom: 12 }}>Code invalide. Veuillez réessayer.</p>}
      <div style={{ fontSize: 12, color: S.ter, marginBottom: 16 }}>
        {otpTimer > 0 ? `Renvoyer le code dans 0:${otpTimer.toString().padStart(2, "0")}` : (
          <span>
            <button style={{ color: S.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 500, fontSize: 12 }} onClick={() => setOtpTimer(59)}>Renvoyer par email</button>
          </span>
        )}
      </div>
    </div>
  );

  /* ─── Password Screen (reusable) ─── */
  const renderPasswordScreen = () => (
    <div>
      <BackLink onClick={goBack} />
      <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Créez votre mot de passe</h1>
      <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Dernière étape !</p>
      <div style={{ marginBottom: 14 }}>
        <TfInput value={password} onChange={setPassword} placeholder="Minimum 8 caractères" type={showPw ? "text" : "password"} autoFocus
          rightIcon={<button style={{ background: "none", border: "none", cursor: "pointer", color: S.sec }} onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
        />
        {password && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= pwStrength ? pwColors[pwStrength] : S.line, transition: "background .3s" }} />)}
            </div>
            <p style={{ fontSize: 11, color: pwColors[pwStrength], marginTop: 4 }}>{pwLabels[pwStrength]}</p>
          </div>
        )}
      </div>
      <TfInput value={passwordConfirm} onChange={setPasswordConfirm} placeholder="Confirmez" type={showPwConfirm ? "text" : "password"} error={pwMatch ? "Les mots de passe ne correspondent pas" : ""}
        rightIcon={<button style={{ background: "none", border: "none", cursor: "pointer", color: S.sec }} onClick={() => setShowPwConfirm(!showPwConfirm)}>{showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
      />
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16, cursor: "pointer" }}>
        <div onClick={() => setAcceptTerms(!acceptTerms)} style={{
          width: 18, height: 18, minWidth: 18, borderRadius: 4, border: `1px solid ${acceptTerms ? S.blue : S.line}`,
          background: acceptTerms ? S.blue : "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: 1, cursor: "pointer", transition: "all .2s",
        }}>{acceptTerms && <Check size={12} color="#fff" />}</div>
        <span style={{ fontSize: 12, color: S.sec }}>
          J'accepte les <a href="/cgv" style={{ color: S.blue }}>conditions générales</a> et la <a href="/politique-confidentialite" style={{ color: S.blue }}>politique de confidentialité</a>
        </span>
      </label>
      <div style={{ marginTop: 16 }}>
        <Cta variant="green" onClick={handleSubmit} disabled={!isPasswordValid}>Créer mon compte</Cta>
        <KbdHint />
      </div>
    </div>
  );

  /* ─── Done Screen (reusable) ─── */
  const renderDoneScreen = () => (
    <div style={{ textAlign: "center" }}>
      <div className="tf-check-pop" style={{ width: 64, height: 64, borderRadius: "50%", background: S.blueBg, border: `2px solid ${S.blue}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Clock size={28} color={S.blue} />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 8 }}>Inscription enregistrée !</h1>
      <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>
        {role === "seller"
          ? "Notre équipe examine votre dossier vendeur. Vous recevrez un email d'activation sous 24 à 48h ouvrées."
          : "Notre équipe vérifie votre profil professionnel. Vous recevrez un email d'activation sous 24 à 48h ouvrées."}
      </p>
      <div style={{ background: S.blueBg, borderRadius: S.radius, padding: 20, textAlign: "left", marginBottom: 20 }}>
        {(role === "seller"
          ? ["Vérification de votre dossier vendeur (24-48h)", "Activation de votre espace vendeur", "Mise en ligne de vos premiers produits"]
          : ["Vérification de votre profil professionnel (24-48h)", "Activation de votre accès aux tarifs professionnels", "Première commande et accès complet"]
        ).map((text, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
            <div style={{ width: 20, height: 20, minWidth: 20, borderRadius: "50%", background: S.badgeBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: S.blue }}>{i + 1}</div>
            <span style={{ fontSize: 13, color: S.text }}>{text}</span>
          </div>
        ))}
      </div>
      <Cta onClick={() => navigate("/")}>Retour à MediKong.pro</Cta>
      <p style={{ fontSize: 11, color: S.ter, marginTop: 16 }}>Un email de confirmation a été envoyé à {email}.</p>
    </div>
  );

  /* ─── RENDER SCREENS ─── */
  const renderScreen = () => {
    switch (step) {
      /* ═══ STEP 0: Role choice ═══ */
      case 0: return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: S.blueBg, border: `2px solid ${S.blue}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShoppingBag size={28} color={S.blue} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, textAlign: "center" }}>Bienvenue sur MediKong</h1>
          <p style={{ fontSize: 13, color: S.sec, textAlign: "center" }}>Le marketplace médical et pharmaceutique pour les professionnels belges.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 8 }}>
            <Cta icon={ShoppingBag} onClick={() => { setRole("buyer"); goTo(1, "up"); }}>Je souhaite acheter</Cta>
            <Cta variant="secondary" icon={Store} onClick={() => { setRole("seller"); goTo(11, "up"); }}>Je souhaite vendre</Cta>
          </div>
          <p style={{ fontSize: 11, color: S.ter, textAlign: "center" }}>Inscription gratuite · Moins de 3 minutes</p>
        </div>
      );

      /* ═══════ BUYER FLOW ═══════ */
      case 1: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Quel est votre profil ?</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Cela nous permet d'adapter votre expérience et vos tarifs.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="max-[640px]:!grid-cols-1">
            {buyerProfileCards.map(({ value, label, desc, Icon }) => {
              const sel = buyerProfile === value;
              return (
                <button key={value} onClick={() => { setBuyerProfile(value); setTimeout(goNext, 350); }}
                  style={{ position: "relative", background: sel ? S.blueBg : "#fff", border: sel ? `2px solid ${S.blue}` : `1px solid ${S.line}`, borderRadius: S.radius, padding: "14px 16px", textAlign: "left", cursor: "pointer", transition: "all .2s" }}
                >
                  {sel && <div className="tf-check-pop" style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: S.blue, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="#fff" /></div>}
                  <div style={{ width: 32, height: 32, borderRadius: S.radiusSm, background: S.blueBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <Icon size={16} color={S.blue} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: S.ter }}>{desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      );

      case 2: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Quelle est votre adresse email ?</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Nous vous enverrons un code de vérification.</p>
          <TfInput value={email} onChange={v => { setEmail(v); setEmailTouched(true); }} placeholder="votre@email.com" type="email" error={emailError} autoFocus />
          <div style={{ marginTop: 16 }}>
            <Cta onClick={handleSendOtp} disabled={!isEmailValid} loading={sendingOtp}>{sendingOtp ? "Envoi en cours..." : "Recevoir mon code"}</Cta>
            <KbdHint />
          </div>
        </div>
      );

      case 2.5: return renderOtpScreen();

      case 3: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Comment vous appelez-vous ?</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Parfait ! Plus que quelques étapes.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <TfInput value={firstName} onChange={setFirstName} placeholder="Prénom" autoFocus />
            <TfInput value={lastName} onChange={setLastName} placeholder="Nom" />
          </div>
          <TfInput value={phone} onChange={setPhone} placeholder="+32 470 123 456" type="tel" />
          <div style={{ marginTop: 16 }}>
            <Cta onClick={goNext} disabled={!firstName || !lastName || !phone}>Continuer</Cta>
            <KbdHint />
          </div>
        </div>
      );

      case 4: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Votre entreprise</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Pour vérifier votre éligibilité aux tarifs professionnels.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <TfInput value={companyName} onChange={setCompanyName} placeholder="Nom légal" autoFocus />
            <TfInput value={vatNumber} onChange={setVatNumber} placeholder="BE0123.456.789" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <TfSelect value={country} onChange={setCountry} options={countries} placeholder="Pays" />
              <TfInput value={city} onChange={setCity} placeholder="Ville" />
            </div>
            {(buyerProfile === "health_pro" || buyerProfile === "pharmacist" || buyerProfile === "care_facility") && (
              <TfInput value={professionalId} onChange={setProfessionalId} placeholder={proIdPlaceholder} />
            )}
            {buyerProfile === "purchasing_group" && (
              <TfSelect value={groupMemberCount} onChange={setGroupMemberCount} options={memberCounts} placeholder="Nombre de membres" />
            )}
            {buyerProfile === "reseller" && (
              <TfInput value={resellerWebsite} onChange={setResellerWebsite} placeholder="https://..." />
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <Cta onClick={goNext} disabled={!isCompanyValid}>Continuer</Cta>
            <KbdHint />
          </div>
        </div>
      );

      case 5: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Qu'est-ce qui vous intéresse ?</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 4 }}>Sélectionnez les catégories pour personnaliser votre catalogue.</p>
          <button onClick={() => setInterests(interests.length === allInterests.length ? [] : [...allInterests])} style={{ fontSize: 12, color: S.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 500, marginBottom: 16 }}>
            {interests.length === allInterests.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {allInterests.map(cat => {
              const sel = interests.includes(cat);
              return (
                <button key={cat} onClick={() => setInterests(sel ? interests.filter(i => i !== cat) : [...interests, cat])}
                  style={{ padding: "8px 16px", borderRadius: 100, fontSize: 12, border: `1px solid ${sel ? S.blue : S.line}`, background: sel ? S.blueBg : "#fff", color: sel ? S.blue : S.sec, fontWeight: sel ? 500 : 400, cursor: "pointer", transition: "all .2s", display: "flex", alignItems: "center", gap: 4 }}
                >
                  {sel && <Check size={12} />} {cat}
                </button>
              );
            })}
          </div>
          <Cta onClick={goNext} disabled={interests.length === 0}>Continuer</Cta>
        </div>
      );

      case 6: return renderPasswordScreen();
      case 7: return renderDoneScreen();

      /* ═══════ SELLER FLOW ═══════ */
      case 11: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Type d'activité</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Quel est votre modèle de vente principal ?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="max-[640px]:!grid-cols-1">
            {sellerBusinessTypes.map(({ id, label, desc, Icon }) => {
              const sel = businessType === id;
              return (
                <button key={id} onClick={() => { setBusinessType(id); setTimeout(goNext, 350); }}
                  style={{ position: "relative", background: sel ? S.blueBg : "#fff", border: sel ? `2px solid ${S.blue}` : `1px solid ${S.line}`, borderRadius: S.radius, padding: "14px 16px", textAlign: "left", cursor: "pointer", transition: "all .2s" }}
                >
                  {sel && <div className="tf-check-pop" style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: S.blue, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="#fff" /></div>}
                  <div style={{ width: 32, height: 32, borderRadius: S.radiusSm, background: S.blueBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <Icon size={16} color={S.blue} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: S.ter }}>{desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      );

      case 12: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Votre adresse email professionnelle</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Pour créer votre espace vendeur.</p>
          <TfInput value={email} onChange={v => { setEmail(v); setEmailTouched(true); }} placeholder="pro@entreprise.com" type="email" error={emailError} autoFocus />
          <div style={{ marginTop: 16 }}>
            <Cta onClick={handleSendOtp} disabled={!isEmailValid} loading={sendingOtp}>{sendingOtp ? "Envoi en cours..." : "Recevoir mon code"}</Cta>
            <KbdHint />
          </div>
        </div>
      );

      case 12.5: return renderOtpScreen();

      case 13: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Vos coordonnées</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Informations de contact professionnel.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <TfInput value={firstName} onChange={setFirstName} placeholder="Prénom" autoFocus />
            <TfInput value={lastName} onChange={setLastName} placeholder="Nom" />
          </div>
          <TfInput value={phone} onChange={setPhone} placeholder="+32 470 123 456" type="tel" style={{ marginBottom: 14 }} />
          <TfInput value={jobTitle} onChange={setJobTitle} placeholder="Fonction (ex: Directeur commercial)" />
          <div style={{ marginTop: 16 }}>
            <Cta onClick={goNext} disabled={!firstName || !lastName || !phone}>Continuer</Cta>
            <KbdHint />
          </div>
        </div>
      );

      case 14: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Votre entreprise</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Informations sur votre société.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <TfInput value={companyName} onChange={setCompanyName} placeholder="Nom de l'entreprise" autoFocus />
            <TfInput value={vatNumber} onChange={setVatNumber} placeholder="BE0123.456.789" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <TfSelect value={country} onChange={setCountry} options={countries} placeholder="Pays" />
              <TfInput value={city} onChange={setCity} placeholder="Ville" />
            </div>
            <TfInput value={website} onChange={setWebsite} placeholder="Site web (https://...)" />
            <TfSelect value={annualRevenue} onChange={setAnnualRevenue} options={revenueOptions} placeholder="Chiffre d'affaires estimé" />
          </div>
          <div style={{ marginTop: 16 }}>
            <Cta onClick={goNext} disabled={!companyName || !country || !city}>Continuer</Cta>
            <KbdHint />
          </div>
        </div>
      );

      case 15: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Vos produits</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 16 }}>Parlez-nous de votre catalogue.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {sellerCategories.map(cat => {
              const sel = sellerCats.includes(cat);
              return (
                <button key={cat} onClick={() => setSellerCats(sel ? sellerCats.filter(c => c !== cat) : [...sellerCats, cat])}
                  style={{ padding: "8px 16px", borderRadius: 100, fontSize: 12, border: `1px solid ${sel ? S.blue : S.line}`, background: sel ? S.blueBg : "#fff", color: sel ? S.blue : S.sec, fontWeight: sel ? 500 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  {sel && <Check size={12} />} {cat}
                </button>
              );
            })}
          </div>
          <TfSelect value={skuCount} onChange={setSkuCount} options={skuOptions} placeholder="Nombre de SKUs" />
          <div style={{ marginTop: 14 }}>
            <TfInput value={brands} onChange={setBrands} placeholder="Marques principales (ex: 3M, Hartmann...)" />
          </div>
          <div style={{ marginTop: 16 }}>
            <Cta onClick={goNext} disabled={sellerCats.length === 0}>Continuer</Cta>
          </div>
        </div>
      );

      case 16: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Logistique & livraison</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Comment expédiez-vous vos produits ?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }} className="max-[640px]:!grid-cols-1">
            {fulfillmentOptions.map(f => {
              const sel = fulfillment === f.id;
              return (
                <button key={f.id} onClick={() => setFulfillment(f.id)}
                  style={{ background: sel ? S.blueBg : "#fff", border: sel ? `2px solid ${S.blue}` : `1px solid ${S.line}`, borderRadius: S.radius, padding: "12px 16px", textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: sel ? S.blue : S.text }}>{f.label}</div>
                </button>
              );
            })}
          </div>
          <TfSelect value={leadTime} onChange={setLeadTime} options={leadTimeOptions} placeholder="Délai moyen de livraison" />
          <div style={{ marginTop: 16 }}>
            <Cta onClick={goNext} disabled={!fulfillment}>Continuer</Cta>
          </div>
        </div>
      );

      case 17: return renderPasswordScreen();
      case 18: return renderDoneScreen();

      default: return null;
    }
  };

  const doneSteps = [7, 18];
  const showDots = step !== 0 && !doneSteps.includes(step);
  const showNav = !doneSteps.includes(step);
  const canGoBack = currentIdx > 0 && !doneSteps.includes(step);

  // Dot steps exclude role choice (0), OTP (x.5), and done steps
  const dotSteps = stepsList.filter(s => s !== 0 && !doneSteps.includes(s) && s !== 2.5 && s !== 12.5);

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* ─── LEFT PANEL — Testimonial ─── */}
      <div className="hidden md:flex" style={{ width: "45%", position: "fixed", left: 0, top: 0, bottom: 0, flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
        {activeTestimonials.map((t, i) => (
          <div key={i} style={{ position: "absolute", inset: 0, background: t.gradient, opacity: tIdx % activeTestimonials.length === i ? 1 : 0, transition: "opacity 0.8s ease" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(30,41,59,.3), rgba(30,41,59,.85))" }} />
          </div>
        ))}
        <div style={{ position: "absolute", top: 32, left: 32, zIndex: 2 }}><Logo white size={22} /></div>
        <div style={{ position: "relative", zIndex: 2, padding: "0 32px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
            {activeTestimonials.slice(0, 3).map((t, i) => {
              const initials = t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
              return (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: t.photo_url ? `url(${t.photo_url}) center/cover` : ["#475569", "#1B5BDA", "#059669"][i % 3],
                  border: "2px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff", marginLeft: i ? -8 : 0, zIndex: 3 - i, overflow: "hidden",
                }}>
                  {!t.photo_url && initials}
                </div>
              );
            })}
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginLeft: 10 }}>
              {role === "seller" ? "+150 vendeurs partenaires nous font confiance" : "+200 professionnels de santé nous font confiance"}
            </span>
          </div>
          {activeTestimonials.map((t, i) => (
            <div key={i} style={{ position: tIdx % activeTestimonials.length === i ? "relative" : "absolute", opacity: tIdx % activeTestimonials.length === i ? 1 : 0, transition: "opacity 0.8s ease", bottom: tIdx % activeTestimonials.length === i ? undefined : 0, left: tIdx % activeTestimonials.length === i ? undefined : 0, right: tIdx % activeTestimonials.length === i ? undefined : 0 }}>
              {t.photo_url ? (
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", marginBottom: 16, border: "1px solid rgba(255,255,255,.2)" }}>
                  <img src={t.photo_url} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.2)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
                  {t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
              )}
              <p style={{ fontSize: 16, fontWeight: 500, color: "#fff", lineHeight: 1.65, fontStyle: "italic", marginBottom: 16 }}>« {t.quote} »</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{t.name}</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,.6)" }}>{t.title}</p>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            {activeTestimonials.map((_, i) => (
              <button key={i} onClick={() => setTIdx(i)} style={{
                width: tIdx % activeTestimonials.length === i ? 24 : 8, height: 8,
                borderRadius: tIdx % activeTestimonials.length === i ? 4 : "50%",
                background: tIdx % activeTestimonials.length === i ? "#fff" : "rgba(255,255,255,.35)",
                border: "none", cursor: "pointer", transition: "all .3s",
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL — Form ─── */}
      <div className="md:ml-[45%]" style={{ flex: 1, minHeight: "100vh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        <div className="md:hidden" style={{ padding: "20px 20px 0" }}><Logo size={20} /></div>
        <div style={{ width: "100%", maxWidth: 480, flex: 1, display: "flex", flexDirection: "column", padding: "32px 24px" }} className="md:!px-12">
          {showDots && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32, flexShrink: 0 }}>
              {dotSteps.map((s, i) => {
                const ci = dotSteps.indexOf(step === 2.5 ? 2 : step === 12.5 ? 12 : step);
                const passed = i < ci;
                const active = i === ci;
                return (
                  <div key={i} className={active ? "tf-dot-pulse" : ""} style={{
                    width: active ? 10 : 8, height: active ? 10 : 8, borderRadius: "50%",
                    background: active ? S.blue : passed ? S.green : S.line, transition: "all .3s",
                  }} />
                );
              })}
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className={animClass} ref={screenRef}>{renderScreen()}</div>
          </div>
          <div style={{ fontSize: 11, color: S.ter, textAlign: "center", paddingTop: 16, flexShrink: 0 }}>
            Balooh SRL · TVA BE 1005.771.323 · support@medikong.pro
          </div>
        </div>
      </div>

      {/* ─── NAV ARROWS ─── */}
      {showNav && (
        <div className="hidden md:flex" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50, flexDirection: "column", gap: 6 }}>
          <button onClick={goBack} disabled={!canGoBack} style={{
            width: 36, height: 36, borderRadius: S.radiusSm, border: `1px solid ${S.line}`, background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: canGoBack ? "pointer" : "default",
            opacity: canGoBack ? 1 : 0.35, color: S.sec, transition: "all .2s",
          }}><ChevronUp size={16} /></button>
          <button disabled style={{
            width: 36, height: 36, borderRadius: S.radiusSm, border: `1px solid ${S.line}`, background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "default",
            opacity: 0.35, color: S.sec,
          }}><ChevronDown size={16} /></button>
        </div>
      )}
    </div>
  );
}
