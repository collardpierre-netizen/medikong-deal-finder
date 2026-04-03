import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingBag, Briefcase, User, Stethoscope, Pill, Building2, Layers, Store,
  ChevronLeft, ChevronUp, ChevronDown, Lock, Eye, EyeOff, Check, ArrowRight,
  Clock, Loader2, Activity, Smile, Home, Sparkles, Footprints, Heart,
} from "lucide-react";

/* ─── Lucide icon resolver ─── */
const iconMap: Record<string, React.ElementType> = {
  Pill, Smile, Home, Building2, Activity, Stethoscope, Sparkles, Footprints, Heart, Briefcase,
};
const resolveIcon = (name: string) => iconMap[name] || Briefcase;

/* ─── Design tokens ─── */
const S = {
  bg: "#F1F5F9", card: "#FFFFFF", text: "#1D2530", sec: "#616B7C", ter: "#8B95A5",
  blue: "#1B5BDA", navy: "#1E293B", green: "#059669", red: "#EF4343",
  amber: "#F59E0B", pink: "#E70866", purple: "#7C3AED",
  line: "#E2E8F0", lb: "#CBD5E1",
  blueBg: "#EFF6FF", greenBg: "#F0FDF4", redBg: "#FEF2F2", badgeBg: "#BFDBFE",
  radius: 10, radiusSm: 6,
};

/* ─── Testimonials ─── */
const testimonials = [
  { gradient: "linear-gradient(135deg, #1a365d, #2d3748, #1a202c)", initials: "SC", quote: "« MediKong nous a permis de centraliser nos achats de consommables avec une transparence totale sur les prix. Un vrai gain de temps au quotidien. »", name: "Dr. Sophie Claessens", title: "Directrice médicale — Clinique Saint-Luc, Bruxelles" },
  { gradient: "linear-gradient(135deg, #064e3b, #1e3a5f, #1a202c)", initials: "PL", quote: "« Les délais de livraison sont fiables et le suivi est impeccable. Nos services peuvent enfin commander sans stress. »", name: "Philippe Lemaire", title: "Responsable achats — CHU de Liège" },
  { gradient: "linear-gradient(135deg, #4c1d95, #1e3a5f, #1a202c)", initials: "MV", quote: "« L'interface est intuitive, les prix sont clairs. J'ai trouvé tout mon matériel de rééducation en quelques clics. Je recommande ! »", name: "Marie Vandenberghe", title: "Kinésithérapeute indépendante — Gand" },
];

/* ─── Profile cards ─── */
const profileCards = [
  { value: "health_pro", label: "Professionnel de santé", desc: "Médecin, kiné, dentiste, infirmier...", Icon: Stethoscope },
  { value: "pharmacist", label: "Pharmacien", desc: "Officine, pharmacie en ligne", Icon: Pill },
  { value: "care_facility", label: "Établissement de soins", desc: "Hôpital, clinique, EHPAD, MR/MRS", Icon: Building2 },
  { value: "purchasing_group", label: "Centrale d'achat / Groupement", desc: "Achats groupés, volumes, appels d'offres", Icon: Layers },
  { value: "reseller", label: "Revendeur / Distributeur", desc: "E-shop, parapharmacie, retailer", Icon: Store },
];

/* ─── Interests ─── */
const allInterests = [
  "Dispositifs médicaux", "Équipements de diagnostic", "Consommables médicaux",
  "Pharmacie & Médicaments", "Parapharmacie", "Compléments alimentaires",
  "Hygiène & Désinfection", "Matériel de rééducation", "Orthopédie & Prothèses",
  "Optique & Audiologie", "Soins dentaires", "Mobilier médical",
  "Vêtements professionnels", "Solutions digitales santé",
];

/* ─── Countries ─── */
const countries = ["Belgique", "France", "Pays-Bas", "Luxembourg", "Allemagne"];
const memberCounts = ["< 10", "10-50", "50-200", "> 200"];

/* ─── Logo ─── */
import logoLight from "@/assets/logo-horizontal.png";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";
const Logo = ({ white = false, size = 22 }: { white?: boolean; size?: number }) => (
  <img src={white ? logoLight : logoDark} alt="MediKong.pro" style={{ height: size + 14 }} />
);

/* ─── Kbd hint ─── */
const KbdHint = () => (
  <div className="hidden md:flex items-center justify-center gap-1.5 mt-3 tf-enter-pulse">
    <kbd style={{ padding: "2px 8px", border: `1px solid ${S.line}`, borderRadius: 4, background: "#fff", fontSize: 11, fontWeight: 600, color: S.sec, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
      Entrée ↵
    </kbd>
  </div>
);

/* ─── CTA ─── */
const Cta = ({ children, onClick, disabled, variant = "navy", icon: Icon, loading }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "navy" | "green" | "secondary"; icon?: React.ElementType; loading?: boolean;
}) => {
  const bg = variant === "green" ? S.green : variant === "secondary" ? "#fff" : S.navy;
  const color = variant === "secondary" ? S.text : "#fff";
  const border = variant === "secondary" ? `1px solid ${S.line}` : "none";
  return (
    <button
      onClick={onClick} disabled={disabled || loading}
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

/* ─── Back link ─── */
const BackLink = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: S.sec, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
    <ChevronLeft size={14} /> Retour
  </button>
);

/* ─── Input ─── */
const TfInput = ({ value, onChange, placeholder, type = "text", error, autoFocus, style: extraStyle, rightIcon }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
  error?: string; autoFocus?: boolean; style?: React.CSSProperties; rightIcon?: React.ReactNode;
}) => (
  <div style={{ position: "relative", width: "100%" }}>
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      autoFocus={autoFocus}
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

/* ─── Select ─── */
const TfSelect = ({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) => (
  <select
    value={value} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${S.line}`, borderRadius: S.radiusSm, fontSize: 13, color: value ? S.text : S.lb, background: "#fff", fontFamily: "'DM Sans', sans-serif", outline: "none" }}
  >
    <option value="" disabled>{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function BuyerOnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [animClass, setAnimClass] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);

  /* State */
  const OTP_LENGTH = 8;
  const EMPTY_OTP = Array.from({ length: OTP_LENGTH }, () => "");
  const [accountType, setAccountType] = useState("");
  const [buyerProfile, setBuyerProfile] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [otpDigits, setOtpDigits] = useState(EMPTY_OTP);
  const [otpError, setOtpError] = useState(false);
  const [otpShake, setOtpShake] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(59);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [professionTypeId, setProfessionTypeId] = useState<string>("");

  /* Fetch profession types from DB */
  const { data: professionTypes = [] } = useQuery({
    queryKey: ["profession-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profession_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [country, setCountry] = useState("Belgique");
  const [city, setCity] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [groupMemberCount, setGroupMemberCount] = useState("");
  const [resellerWebsite, setResellerWebsite] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  /* Testimonial slideshow */
  const [tIdx, setTIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTIdx(p => (p + 1) % testimonials.length), 8000);
    return () => clearInterval(iv);
  }, []);

  /* OTP timer */
  useEffect(() => {
    if (step !== 2.5) return;
    setOtpTimer(59);
    const iv = setInterval(() => setOtpTimer(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [step]);

  /* OTP refs */
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* Step mapping — maps logical steps to display index for dots */
  const getSteps = useCallback(() => {
    if (accountType === "pro") return [0, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7];
    return [0, 1.5, 2, 2.5, 3, 5, 6, 7];
  }, [accountType]);

  const stepsList = getSteps();
  const currentIdx = stepsList.indexOf(step);
  const dotSteps = stepsList.filter(s => s !== 0 && s !== 7 && s !== 2.5);

  /* Navigate to step */
  const goTo = useCallback((target: number, direction: "up" | "down") => {
    if (transitioning) return;
    setTransitioning(true);
    setDir(direction);
    setAnimClass(direction === "up" ? "tf-slide-up-out" : "tf-slide-down-out");
    setTimeout(() => {
      setStep(target);
      setAnimClass(direction === "up" ? "tf-slide-up-in" : "tf-slide-down-in");
      setTimeout(() => {
        setAnimClass("");
        setTransitioning(false);
      }, 500);
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

  /* Enter key */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !transitioning) {
        if (step === 2 && isEmailValid) { handleSendOtp(); }
        else if (step === 3 && firstName && lastName && phone) goNext();
        else if (step === 4 && isCompanyValid) goNext();
        else if (step === 5 && interests.length > 0) goNext();
        else if (step === 6 && isPasswordValid) handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  /* Validation helpers */
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);
  const emailError = emailTouched && email && !isEmailValid ? "Adresse email invalide" : "";

  const pwStrength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const pwLabels = ["", "Faible", "Moyen", "Fort", "Très fort"];
  const pwColors = ["", S.red, S.amber, S.blue, S.green];
  const pwMatch = password && passwordConfirm && password !== passwordConfirm;
  const isPasswordValid = password.length >= 8 && password === passwordConfirm && acceptTerms;

  const proIdLabel = buyerProfile === "health_pro" ? "N° INAMI / Visa" : buyerProfile === "pharmacist" ? "N° d'agrément pharmacie" : buyerProfile === "care_facility" ? "N° d'agrément" : "";
  const proIdPlaceholder = buyerProfile === "health_pro" ? "Ex : 1-12345-67-890" : buyerProfile === "pharmacist" ? "Ex : APB 1234" : "FAGG/AFMPS (optionnel)";
  const proIdRequired = buyerProfile === "health_pro" || buyerProfile === "pharmacist";

  const isCompanyValid = companyName && vatNumber && country && city && (
    buyerProfile === "purchasing_group" ? !!groupMemberCount :
    buyerProfile === "reseller" ? true :
    proIdRequired ? !!professionalId : true
  );

  /* OTP handler */
  const handleSendOtp = () => {
    if (!isEmailValid) return;
    setSendingOtp(true);
    setTimeout(() => { setSendingOtp(false); goNext(); }, 1000);
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const newDigits = [...otpDigits];
    newDigits[idx] = val;
    setOtpDigits(newDigits);
    setOtpError(false);
    if (val && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus();
    if (newDigits.every(d => d) ) {
      const code = newDigits.join("");
      if (code === "12345678") {
        setOtpVerified(true);
        setTimeout(() => goNext(), 400);
      } else {
        setOtpError(true);
        setOtpShake(true);
        setTimeout(() => setOtpShake(false), 400);
      }
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (text.length === OTP_LENGTH) {
      e.preventDefault();
      const newDigits = text.split("");
      setOtpDigits(newDigits);
      otpRefs.current[OTP_LENGTH - 1]?.focus();
      if (text === "12345678") {
        setOtpVerified(true);
        setTimeout(() => goNext(), 400);
      } else {
        setOtpError(true);
        setOtpShake(true);
        setTimeout(() => setOtpShake(false), 400);
      }
    }
  };

  /* Submit */
  const handleSubmit = () => {
    if (!isPasswordValid) return;
    const data = { accountType, buyerProfile, professionTypeId, email, firstName, lastName, phone, companyName, vatNumber, country, city, professionalId, groupMemberCount, resellerWebsite, interests, acceptTerms };
    console.log("Buyer onboarding data:", data);
    goNext();
  };

  /* ─── RENDER SCREENS ─── */
  const renderScreen = () => {
    switch (step) {
      case 0: return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: S.blueBg, border: `2px solid ${S.blue}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShoppingBag size={28} color={S.blue} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, textAlign: "center" }}>Bienvenue sur MediKong</h1>
          <p style={{ fontSize: 13, color: S.sec, textAlign: "center" }}>Le marketplace médical et pharmaceutique pour les professionnels et les particuliers.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 8 }}>
            <Cta icon={Briefcase} onClick={() => { setAccountType("pro"); goNext(); }}>Je suis un professionnel</Cta>
            <Cta variant="secondary" icon={User} onClick={() => { setAccountType("personal"); goNext(); }}>Je suis un particulier</Cta>
          </div>
          <p style={{ fontSize: 11, color: S.ter, textAlign: "center" }}>Inscription gratuite · Moins de 2 minutes</p>
        </div>
      );

      case 1: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Quel est votre profil ?</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Cela nous permet d'adapter votre expérience et vos tarifs.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="max-[640px]:!grid-cols-1">
            {profileCards.map(({ value, label, desc, Icon }) => {
              const sel = buyerProfile === value;
              return (
                <button key={value} onClick={() => { setBuyerProfile(value); setTimeout(goNext, 350); }}
                  style={{ position: "relative", background: sel ? S.blueBg : "#fff", border: sel ? `2px solid ${S.blue}` : `1px solid ${S.line}`, borderRadius: S.radius, padding: "14px 16px", textAlign: "left", cursor: "pointer", transition: "all .2s" }}
                  onMouseEnter={e => { if (!sel) { (e.currentTarget as HTMLElement).style.borderColor = S.blue; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,.08)"; } }}
                  onMouseLeave={e => { if (!sel) { (e.currentTarget as HTMLElement).style.borderColor = S.line; (e.currentTarget as HTMLElement).style.boxShadow = "none"; } }}
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

      case 1.5: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Quel est votre type d'établissement ?</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Nous personnalisons votre catalogue en fonction de votre activité.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="max-[640px]:!grid-cols-1">
            {professionTypes.map((pt: any) => {
              const sel = professionTypeId === pt.id;
              const PtIcon = resolveIcon(pt.icon);
              return (
                <button key={pt.id} onClick={() => { setProfessionTypeId(pt.id); setTimeout(goNext, 350); }}
                  style={{ position: "relative", background: sel ? S.blueBg : "#fff", border: sel ? `2px solid ${S.blue}` : `1px solid ${S.line}`, borderRadius: S.radius, padding: "14px 16px", textAlign: "left", cursor: "pointer", transition: "all .2s" }}
                  onMouseEnter={e => { if (!sel) { (e.currentTarget as HTMLElement).style.borderColor = S.blue; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,.08)"; } }}
                  onMouseLeave={e => { if (!sel) { (e.currentTarget as HTMLElement).style.borderColor = S.line; (e.currentTarget as HTMLElement).style.boxShadow = "none"; } }}
                >
                  {sel && <div className="tf-check-pop" style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: S.blue, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="#fff" /></div>}
                  <div style={{ width: 32, height: 32, borderRadius: S.radiusSm, background: S.blueBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <PtIcon size={16} color={S.blue} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{pt.name}</div>
                  <div style={{ fontSize: 11, color: S.ter }}>{pt.description}</div>
                </button>
              );
            })}
          </div>
          <button onClick={goNext} style={{ display: "block", margin: "16px auto 0", fontSize: 12, color: S.sec, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Passer cette étape
          </button>
        </div>
      );

      case 2: return (
        <div>
          <BackLink onClick={goBack} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Quelle est votre adresse email ?</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>Nous vous enverrons un code de vérification.</p>
          <TfInput value={email} onChange={v => { setEmail(v); setEmailTouched(true); }} placeholder="votre@email.com" type="email" error={emailError} autoFocus />
          <div style={{ marginTop: 16 }}>
            <Cta onClick={handleSendOtp} disabled={!isEmailValid} loading={sendingOtp}>
              {sendingOtp ? "Envoi en cours..." : "Recevoir mon code"}
            </Cta>
            <KbdHint />
          </div>
          <p style={{ fontSize: 11, color: S.ter, marginTop: 16, textAlign: "center" }}>Nous ne partagerons jamais votre email. Politique RGPD.</p>
        </div>
      );

      case 2.5: return (
        <div style={{ textAlign: "center" }}>
          <BackLink onClick={goBack} />
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: S.blueBg, border: `2px solid ${S.blue}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Lock size={24} color={S.blue} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 6 }}>Vérifiez votre email</h1>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 24 }}>Un code à 8 chiffres a été envoyé à <strong>{email}</strong></p>
          <div className={otpShake ? "tf-shake" : ""} style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }} onPaste={handleOtpPaste}>
            {otpDigits.map((d, i) => (
              <input key={i} ref={el => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                autoFocus={i === 0}
                style={{
                  width: 48, height: 56, border: `${d ? "2px" : "1px"} solid ${otpError ? S.red : d ? S.green : S.line}`,
                  borderRadius: S.radius, fontSize: 24, fontWeight: 700, textAlign: "center",
                  background: otpError ? S.redBg : d ? S.greenBg : "#fff", outline: "none",
                  fontFamily: "'DM Sans', sans-serif",
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
                {" · "}
                <button style={{ color: S.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 500, fontSize: 12 }} onClick={() => setOtpTimer(59)}>Par SMS</button>
              </span>
            )}
          </div>
          <button onClick={() => goBack()} style={{ fontSize: 12, color: S.sec, background: "none", border: "none", cursor: "pointer" }}>Changer d'adresse email</button>
        </div>
      );

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
          <p style={{ fontSize: 11, color: S.sec, marginTop: 16, textAlign: "center", fontStyle: "italic" }}>Ces infos restent confidentielles.</p>
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
            {/* Conditional field */}
            {(buyerProfile === "health_pro" || buyerProfile === "pharmacist" || buyerProfile === "care_facility") && (
              <div>
                <TfInput value={professionalId} onChange={setProfessionalId} placeholder={proIdPlaceholder} />
                {buyerProfile === "health_pro" && <p style={{ fontSize: 11, color: S.ter, marginTop: 4 }}>Numéro d'identification INAMI</p>}
              </div>
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
                  style={{
                    padding: "8px 16px", borderRadius: 100, fontSize: 12,
                    border: `1px solid ${sel ? S.blue : S.line}`,
                    background: sel ? S.blueBg : "#fff", color: sel ? S.blue : S.sec,
                    fontWeight: sel ? 500 : 400, cursor: "pointer", transition: "all .2s",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  {sel && <Check size={12} />}
                  {cat}
                </button>
              );
            })}
          </div>
          <Cta onClick={goNext} disabled={interests.length === 0}>Continuer</Cta>
          <KbdHint />
        </div>
      );

      case 6: return (
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
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= pwStrength ? pwColors[pwStrength] : S.line, transition: "background .3s" }} />
                  ))}
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
            }}>
              {acceptTerms && <Check size={12} color="#fff" />}
            </div>
            <span style={{ fontSize: 12, color: S.sec }}>
              J'accepte les <a href="/cgv" style={{ color: S.blue }}>conditions générales</a> et la <a href="/politique-confidentialite" style={{ color: S.blue }}>politique de confidentialité</a>
            </span>
          </label>
          <p style={{ fontSize: 11, color: S.ter, marginTop: 8, marginLeft: 26 }}>RGPD · Balooh SRL · TVA BE 1005.771.323</p>
          <div style={{ marginTop: 16 }}>
            <Cta variant="green" onClick={handleSubmit} disabled={!isPasswordValid}>Créer mon compte</Cta>
            <KbdHint />
          </div>
        </div>
      );

      case 7: {
        const isB2B = accountType === "pro";
        return (
          <div style={{ textAlign: "center" }}>
            <div className="tf-check-pop" style={{ width: 64, height: 64, borderRadius: "50%", background: S.blueBg, border: `2px solid ${S.blue}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Clock size={28} color={S.blue} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 8 }}>Inscription enregistrée !</h1>
            <p style={{ fontSize: 13, color: S.sec, marginBottom: 20 }}>
              {isB2B
                ? "Notre équipe vérifie votre profil professionnel et vos accréditations. Vous recevrez un email d'activation sous 24 à 48h ouvrées."
                : "Notre équipe examine votre demande. Vous recevrez un email d'activation sous 24 à 48h ouvrées."}
            </p>
            <div style={{ background: S.blueBg, borderRadius: S.radius, padding: 20, textAlign: "left", marginBottom: 20 }}>
              {(isB2B
                ? ["Vérification de votre profil professionnel (24-48h)", "Activation de votre accès aux tarifs professionnels", "Première commande et accès complet"]
                : ["Examen de votre inscription (24-48h)", "Activation de votre compte par email", "Première commande sur MediKong"]
              ).map((text, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
                  <div style={{ width: 20, height: 20, minWidth: 20, borderRadius: "50%", background: S.badgeBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: S.blue }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: S.text }}>{text}</span>
                </div>
              ))}
            </div>
            <Cta onClick={() => navigate("/")}>Retour à MediKong.pro</Cta>
            <p style={{ fontSize: 11, color: S.ter, marginTop: 16 }}>Un email de confirmation a été envoyé à {email}. Aucun accès tant que votre compte n'est pas activé.</p>
          </div>
        );
      }
      default: return null;
    }
  };

  const showDots = step !== 0 && step !== 7;
  const showNav = step !== 7;
  const canGoBack = currentIdx > 0 && step !== 7;
  const canGoForward = false; // forward via CTA only

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* ─── LEFT PANEL — Testimonial ─── */}
      <div className="hidden md:flex" style={{ width: "45%", position: "fixed", left: 0, top: 0, bottom: 0, flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
        {testimonials.map((t, i) => (
          <div key={i} style={{ position: "absolute", inset: 0, background: t.gradient, opacity: tIdx === i ? 1 : 0, transition: "opacity 0.8s ease" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(30,41,59,.3), rgba(30,41,59,.85))" }} />
          </div>
        ))}
        <div style={{ position: "absolute", top: 32, left: 32, zIndex: 2 }}><Logo white size={22} /></div>
        <div style={{ position: "relative", zIndex: 2, padding: "0 32px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: ["#475569", "#1B5BDA", "#059669"][i], border: "2px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", marginLeft: i ? -8 : 0, zIndex: 3 - i }}>
                {testimonials[i].initials[0]}
              </div>
            ))}
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginLeft: 10 }}>+200 professionnels de santé nous font confiance</span>
          </div>
          {testimonials.map((t, i) => (
            <div key={i} style={{ position: tIdx === i ? "relative" : "absolute", opacity: tIdx === i ? 1 : 0, transition: "opacity 0.8s ease", bottom: tIdx === i ? undefined : 0, left: tIdx === i ? undefined : 0, right: tIdx === i ? undefined : 0 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.2)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>{t.initials}</div>
              <p style={{ fontSize: 16, fontWeight: 500, color: "#fff", lineHeight: 1.65, fontStyle: "italic", marginBottom: 16 }}>{t.quote}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{t.name}</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,.6)" }}>{t.title}</p>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            {[0, 1, 2].map(i => (
              <button key={i} onClick={() => setTIdx(i)} style={{
                width: tIdx === i ? 24 : 8, height: 8, borderRadius: tIdx === i ? 4 : "50%",
                background: tIdx === i ? "#fff" : "rgba(255,255,255,.35)", border: "none",
                cursor: "pointer", transition: "all .3s",
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL — Form ─── */}
      <div className="md:ml-[45%]" style={{ flex: 1, minHeight: "100vh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        <div className="md:hidden" style={{ padding: "20px 20px 0" }}><Logo size={20} /></div>
        <div style={{ width: "100%", maxWidth: 480, flex: 1, display: "flex", flexDirection: "column", padding: "32px 24px" }} className="md:!px-12">
          {/* Dots */}
          {showDots && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32, flexShrink: 0 }}>
              {dotSteps.map((s, i) => {
                const ci = dotSteps.indexOf(step === 2.5 ? 2 : step);
                const passed = i < ci;
                const active = i === ci;
                return (
                  <div key={i} className={active ? "tf-dot-pulse" : ""} style={{
                    width: active ? 10 : 8, height: active ? 10 : 8, borderRadius: "50%",
                    background: active ? S.blue : passed ? S.green : S.line,
                    transition: "all .3s",
                  }} />
                );
              })}
            </div>
          )}
          {/* Screen content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className={animClass} ref={screenRef}>
              {renderScreen()}
            </div>
          </div>
          {/* Footer RGPD */}
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
