import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, FileText, CreditCard, Shield, Check, Lock } from "lucide-react";

const S = {
  bg: "#F1F5F9", card: "#FFFFFF", text: "#1D2530", sec: "#616B7C", ter: "#8B95A5",
  blue: "#1B5BDA", navy: "#1E293B", green: "#059669", red: "#EF4343",
  line: "#E2E8F0", lb: "#CBD5E1", pink: "#E70866",
  blueBg: "#EFF6FF", greenBg: "#F0FDF4",
  radius: 10, radiusSm: 6,
};

const Logo = () => (
  <span style={{ fontWeight: 700, fontSize: 20, fontFamily: "'DM Sans', sans-serif" }}>
    <span style={{ color: S.navy }}>MediKong</span><span style={{ color: S.pink }}>.pro</span>
  </span>
);

const Input = ({ value, onChange, placeholder, style: extra, half }: any) => (
  <input value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${S.line}`, borderRadius: S.radiusSm, fontSize: 13, outline: "none", color: S.text, fontFamily: "'DM Sans', sans-serif", background: "#fff", ...extra }}
    onFocus={e => { e.target.style.borderColor = S.blue; }} onBlur={e => { e.target.style.borderColor = S.line; }}
  />
);

const Select = ({ value, onChange, options, placeholder }: any) => (
  <select value={value} onChange={(e: any) => onChange(e.target.value)}
    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${S.line}`, borderRadius: S.radiusSm, fontSize: 13, color: value ? S.text : S.lb, background: "#fff", fontFamily: "'DM Sans', sans-serif", outline: "none" }}>
    <option value="" disabled>{placeholder}</option>
    {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
  </select>
);

const mockCart = [
  { id: 1, name: "Gants Nitrile M x200", qty: 3, price: 14.50, img: "/placeholder.svg" },
  { id: 2, name: "Masques FFP2 x50", qty: 1, price: 24.90, img: "/placeholder.svg" },
  { id: 3, name: "Désinfectant Surface 5L", qty: 2, price: 18.00, img: "/placeholder.svg" },
];

export default function BuyerCompletionPage() {
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);

  /* Shipping */
  const [sFirstName, setSFirstName] = useState("Sophie");
  const [sLastName, setSLastName] = useState("Claessens");
  const [sCompany, setSCompany] = useState("Clinique Saint-Luc");
  const [sStreet, setSStreet] = useState("");
  const [sLine2, setSLine2] = useState("");
  const [sPostal, setSPostal] = useState("");
  const [sCity, setSCity] = useState("");
  const [sCountry, setSCountry] = useState("Belgique");
  const [sPhone, setSPhone] = useState("+32 470 123 456");
  const [saveDefault, setSaveDefault] = useState(true);

  /* Billing */
  const [billingSame, setBillingSame] = useState(true);
  const [bFirstName, setBFirstName] = useState("");
  const [bLastName, setBLastName] = useState("");
  const [bStreet, setBStreet] = useState("");
  const [bPostal, setBPostal] = useState("");
  const [bCity, setBCity] = useState("");
  const [bCountry, setBCountry] = useState("Belgique");
  const [bVat, setBVat] = useState("");

  /* Payment */
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const subtotal = mockCart.reduce((s, i) => s + i.price * i.qty, 0);
  const tva = +(subtotal * 0.21).toFixed(2);
  const total = +(subtotal + tva).toFixed(2);

  const formValid = sStreet && sPostal && sCity && sCountry && cardNumber.length >= 12;

  const handleConfirm = () => {
    console.log("Order confirmed", { shipping: { sFirstName, sLastName, sStreet, sPostal, sCity, sCountry }, billing: billingSame ? "same" : { bFirstName, bLastName, bStreet, bPostal, bCity, bCountry, bVat } });
    setConfirmed(true);
  };

  if (confirmed) {
    return (
      <div style={{ minHeight: "100vh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div className="tf-check-pop" style={{ width: 64, height: 64, borderRadius: "50%", background: S.greenBg, border: `2px solid ${S.green}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Check size={28} color={S.green} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 8 }}>Commande confirmée !</h1>
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: S.radiusSm, background: S.navy, color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>MK-2026-00042</div>
          <p style={{ fontSize: 13, color: S.sec, marginBottom: 24 }}>Merci {sFirstName} ! Vous recevrez un email de confirmation à votre adresse.</p>
          <button onClick={() => navigate("/compte")} style={{ width: "100%", padding: "12px 24px", borderRadius: S.radiusSm, background: S.navy, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", marginBottom: 12 }}>
            Voir mes commandes
          </button>
          <button onClick={() => navigate("/")} style={{ width: "100%", padding: "12px 24px", borderRadius: S.radiusSm, background: "#fff", color: S.text, fontWeight: 700, fontSize: 14, border: `1px solid ${S.line}`, cursor: "pointer" }}>
            Continuer mes achats
          </button>
        </div>
      </div>
    );
  }

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <Icon size={18} color={S.navy} />
      <span style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{title}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: S.bg, fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ textAlign: "center", padding: "24px 20px 8px" }}>
        <Logo />
        <p style={{ fontSize: 12, fontWeight: 600, color: S.green, marginTop: 4 }}>Finaliser votre commande</p>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 20px 40px", display: "flex", gap: 24, alignItems: "flex-start" }} className="max-[768px]:!flex-col">
        {/* Left — Form */}
        <div style={{ flex: "0 0 60%" }} className="max-[768px]:!flex-[1_1_100%] max-[768px]:!order-2">
          {/* Section 1: Shipping */}
          <div style={{ background: S.card, border: `1px solid ${S.line}`, borderRadius: S.radius, padding: 20, marginBottom: 20 }}>
            <SectionHeader icon={MapPin} title="Adresse de livraison" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input value={sFirstName} onChange={setSFirstName} placeholder="Prénom" />
                <Input value={sLastName} onChange={setSLastName} placeholder="Nom" />
              </div>
              <Input value={sCompany} onChange={setSCompany} placeholder="Entreprise (optionnel)" />
              <Input value={sStreet} onChange={setSStreet} placeholder="Rue + numéro" />
              <Input value={sLine2} onChange={setSLine2} placeholder="Complément d'adresse (optionnel)" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input value={sPostal} onChange={setSPostal} placeholder="Code postal" />
                <Input value={sCity} onChange={setSCity} placeholder="Ville" />
              </div>
              <Select value={sCountry} onChange={setSCountry} options={["Belgique", "France", "Pays-Bas", "Luxembourg", "Allemagne"]} placeholder="Pays" />
              <Input value={sPhone} onChange={setSPhone} placeholder="Téléphone" />
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <div onClick={() => setSaveDefault(!saveDefault)} style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${saveDefault ? S.blue : S.line}`, background: saveDefault ? S.blue : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {saveDefault && <Check size={12} color="#fff" />}
                </div>
                <span style={{ fontSize: 12, color: S.sec }}>Sauvegarder comme adresse par défaut</span>
              </label>
            </div>
          </div>

          {/* Section 2: Billing */}
          <div style={{ background: S.card, border: `1px solid ${S.line}`, borderRadius: S.radius, padding: 20, marginBottom: 20 }}>
            <SectionHeader icon={FileText} title="Adresse de facturation" />
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 12 }}>
              <div onClick={() => setBillingSame(!billingSame)} style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${billingSame ? S.blue : S.line}`, background: billingSame ? S.blue : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {billingSame && <Check size={12} color="#fff" />}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Identique à l'adresse de livraison</span>
            </label>
            {billingSame ? (
              <div style={{ fontSize: 13, color: S.sec, background: S.bg, borderRadius: S.radiusSm, padding: "8px 12px" }}>
                {sFirstName} {sLastName}, {sStreet || "..."}, {sPostal} {sCity}, {sCountry}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Input value={bFirstName} onChange={setBFirstName} placeholder="Prénom" />
                  <Input value={bLastName} onChange={setBLastName} placeholder="Nom" />
                </div>
                <Input value={bStreet} onChange={setBStreet} placeholder="Rue + numéro" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Input value={bPostal} onChange={setBPostal} placeholder="Code postal" />
                  <Input value={bCity} onChange={setBCity} placeholder="Ville" />
                </div>
                <Select value={bCountry} onChange={setBCountry} options={["Belgique", "France", "Pays-Bas", "Luxembourg", "Allemagne"]} placeholder="Pays" />
                <Input value={bVat} onChange={setBVat} placeholder="N° de TVA (optionnel)" />
              </div>
            )}
          </div>

          {/* Section 3: Payment */}
          <div style={{ background: S.card, border: `1px solid ${S.line}`, borderRadius: S.radius, padding: 20 }}>
            <SectionHeader icon={CreditCard} title="Paiement" />
            <div style={{ background: S.bg, border: `1px solid ${S.line}`, borderRadius: S.radius, padding: 20, marginBottom: 16 }}>
              <Input value={cardNumber} onChange={setCardNumber} placeholder="Numéro de carte" style={{ marginBottom: 12 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input value={cardExpiry} onChange={setCardExpiry} placeholder="MM/AA" />
                <Input value={cardCvc} onChange={setCardCvc} placeholder="CVC" />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {["Visa", "Mastercard", "Bancontact", "iDEAL"].map(c => (
                  <span key={c} style={{ fontSize: 11, color: S.ter, border: `1px solid ${S.line}`, borderRadius: 4, padding: "2px 6px" }}>{c}</span>
                ))}
              </div>
            </div>
            <div style={{ background: S.greenBg, border: `1px solid ${S.green}`, borderRadius: S.radius, padding: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Shield size={14} color={S.green} style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: S.sec }}>Paiement sécurisé par Stripe. MediKong ne stocke jamais vos données bancaires.</span>
            </div>
          </div>
        </div>

        {/* Right — Cart summary */}
        <div className="max-[768px]:!flex-[1_1_100%] max-[768px]:!order-1" style={{ flex: "0 0 38%", position: "sticky", top: 24 }}>
          <div style={{ background: S.card, border: `1px solid ${S.line}`, borderRadius: S.radius, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Votre commande</h3>
            {mockCart.map((item, i) => (
              <React.Fragment key={item.id}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <img src={item.img} alt={item.name} style={{ width: 48, height: 48, borderRadius: 4, objectFit: "cover", background: S.bg }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: S.text }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: S.ter }}>Qté : {item.qty}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.text }}>€{(item.price * item.qty).toFixed(2)}</div>
                </div>
                {i < mockCart.length - 1 && <div style={{ height: 1, background: S.line, margin: "12px 0" }} />}
              </React.Fragment>
            ))}
            <div style={{ height: 1, background: S.line, margin: "16px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: S.sec, marginBottom: 6 }}>
              <span>Sous-total HT</span><span>€{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: S.sec, marginBottom: 6 }}>
              <span>TVA (21%)</span><span>€{tva.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: S.green, marginBottom: 12 }}>
              <span>Livraison</span><span style={{ fontWeight: 600 }}>Gratuite</span>
            </div>
            <div style={{ height: 1, background: S.line, marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: S.navy, marginBottom: 16 }}>
              <span>Total TTC</span><span>€{total.toFixed(2)}</span>
            </div>
            <button onClick={handleConfirm} disabled={!formValid}
              style={{
                width: "100%", padding: "12px 24px", borderRadius: S.radiusSm,
                background: formValid ? S.green : "#E5E7EB", color: formValid ? "#fff" : "#9CA3AF",
                fontWeight: 700, fontSize: 14, border: "none", cursor: formValid ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              <Lock size={14} /> Confirmer et payer €{total.toFixed(2)}
            </button>
            <p style={{ fontSize: 11, color: S.ter, textAlign: "center", marginTop: 12 }}>En confirmant, vous acceptez nos CGV et notre politique de retour.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
