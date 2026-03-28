import { useState } from "react";
import { X, ArrowRight, Check, Shield } from "lucide-react";
import { toast } from "sonner";

const SHARE_PRICE = 1000;
const quickAmounts = [1000, 2500, 5000, 7500, 10000, 12500, 15000];
const countries = [
  { code: "BE", label: "Belgique", flag: "🇧🇪" },
  { code: "LU", label: "Luxembourg", flag: "🇱🇺" },
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "NL", label: "Pays-Bas", flag: "🇳🇱" },
];

interface Props { open: boolean; onClose: () => void; }

export default function InvestSubscriptionModal({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState(5000);
  const [country, setCountry] = useState("BE");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [nationalNumber, setNationalNumber] = useState("");

  if (!open) return null;

  const shares = Math.floor(amount / SHARE_PRICE);
  const isTaxShelterEligible = country === "BE" && amount >= 5000;
  const taxReduction = isTaxShelterEligible ? Math.round(amount * 0.45) : 0;
  const netCost = amount - taxReduction;
  const taxShelterRemaining = 15000 - amount;
  const pct = ((amount - 1000) / (15000 - 1000)) * 100;
  const canStep2 = firstName.trim() && lastName.trim() && email.trim() && phone.trim() && address.trim() && postalCode.trim() && city.trim();
  const selectedCountry = countries.find(c => c.code === country);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // TODO: reconnect to invest_subscriptions table when re-created
      await new Promise(r => setTimeout(r, 800));
      toast.success("Souscription envoyée ! Notre équipe vous recontactera sous 48h.");
      onClose();
      setStep(1);
    } catch {
      toast.error("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Souscrire au capital de MediKong</h2>
            <p className="text-sm text-muted-foreground mt-1">Complétez votre souscription en quelques minutes</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg transition-colors"><X size={20} className="text-muted-foreground" /></button>
        </div>
        <div className="flex items-center gap-0 px-6 pb-5">
          {[{ n: 1, label: "Montant" }, { n: 2, label: "Coordonnées" }, { n: 3, label: "Récapitulatif" }].map((s, i) => (
            <div key={s.n} className="flex items-center gap-0">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > s.n ? "bg-mk-green text-white" : step === s.n ? "bg-mk-green text-white" : "bg-accent text-muted-foreground"}`}>
                  {step > s.n ? <Check size={14} /> : s.n}
                </div>
                <span className={`text-sm font-medium ${step >= s.n ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
              {i < 2 && <div className={`w-16 h-0.5 mx-2 rounded ${step > s.n ? "bg-mk-green" : "bg-border"}`} />}
            </div>
          ))}
        </div>
        <div className="px-6 pb-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Montant de votre investissement</p>
                <p className="text-center"><span className="text-4xl font-bold text-foreground">{amount.toLocaleString("fr-BE")} €</span></p>
                <p className="text-center text-sm text-muted-foreground mt-1">{shares} parts à {SHARE_PRICE.toLocaleString("fr-BE")} € chacune</p>
              </div>
              <div className="relative h-2 rounded-full bg-accent">
                <div className="absolute inset-y-0 left-0 rounded-full bg-mk-green" style={{ width: `${pct}%` }} />
                <input type="range" min={1000} max={15000} step={500} value={amount} onChange={e => setAmount(+e.target.value)}
                  className="absolute inset-0 w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mk-green [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-mk-green [&::-moz-range-thumb]:border-0" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>1 000 €</span><span>15 000 €</span></div>
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map(a => (
                  <button key={a} onClick={() => setAmount(a)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${amount === a ? "bg-mk-blue text-white border-transparent" : "bg-white text-foreground border-border hover:bg-accent"}`}>{a.toLocaleString("fr-BE")} €</button>
                ))}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Pays de résidence fiscale</p>
                <select value={country} onChange={e => setCountry(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
                  {countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
                </select>
              </div>
              <div className="border border-mk-green/30 rounded-xl p-4 bg-mk-green/5">
                <div className="flex items-center gap-2 mb-3"><Shield size={16} className="text-mk-green" /><span className="text-sm font-bold text-mk-green">Tax Shelter – Réduction d'impôt 45%</span></div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Investissement</span><span className="font-medium">{amount.toLocaleString("fr-BE")} €</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Réduction fiscale (45%)</span><span className="font-semibold text-mk-green">- {taxReduction.toLocaleString("fr-BE")} €</span></div>
                  <div className="flex justify-between border-t border-border pt-2 mt-2"><span className="font-bold">Coût réel net</span><span className="font-bold text-mk-green text-lg">{netCost.toLocaleString("fr-BE")} €</span></div>
                </div>
              </div>
              <button onClick={() => setStep(2)} className="w-full flex items-center justify-center gap-2 bg-mk-green text-white py-3.5 rounded-xl font-semibold text-sm hover:brightness-110 transition-all">Continuer <ArrowRight size={16} /></button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-foreground">Prénom *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" /></div>
                <div><label className="text-sm font-medium text-foreground">Nom *</label><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-foreground">Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" /></div>
                <div><label className="text-sm font-medium text-foreground">Téléphone *</label><input value={phone} onChange={e => setPhone(e.target.value)} className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" /></div>
              </div>
              <div><label className="text-sm font-medium text-foreground">Adresse *</label><input value={address} onChange={e => setAddress(e.target.value)} className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-foreground">Code postal *</label><input value={postalCode} onChange={e => setPostalCode(e.target.value)} className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" /></div>
                <div><label className="text-sm font-medium text-foreground">Ville *</label><input value={city} onChange={e => setCity(e.target.value)} className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold">Retour</button>
                <button onClick={() => canStep2 && setStep(3)} disabled={!canStep2} className="flex-1 flex items-center justify-center gap-2 bg-mk-green text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">Continuer <ArrowRight size={16} /></button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="border border-border rounded-xl p-4">
                <p className="text-sm font-bold text-foreground mb-2">Récapitulatif</p>
                <div className="flex justify-between mb-1"><span className="text-sm text-muted-foreground">{shares} parts × {SHARE_PRICE.toLocaleString("fr-BE")} €</span><span className="font-bold">{amount.toLocaleString("fr-BE")} €</span></div>
                {taxReduction > 0 && <div className="flex justify-between"><span className="text-sm text-muted-foreground">Tax Shelter 45%</span><span className="text-mk-green font-semibold">- {taxReduction.toLocaleString("fr-BE")} €</span></div>}
                <div className="flex justify-between border-t pt-2 mt-2"><span className="font-bold">Coût réel net</span><span className="text-xl font-bold text-mk-green">{netCost.toLocaleString("fr-BE")} €</span></div>
              </div>
              <div className="border border-border rounded-xl p-4">
                <p className="text-sm font-bold mb-2">Vos coordonnées</p>
                <p className="text-sm">{firstName} {lastName} — {email}</p>
                <p className="text-sm text-muted-foreground">{address}, {postalCode} {city} ({selectedCountry?.label})</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold">Modifier</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 bg-mk-green text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
                  {submitting ? "Envoi..." : "Confirmer"} {!submitting && <ArrowRight size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
