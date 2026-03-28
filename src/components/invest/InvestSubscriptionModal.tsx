import { useState } from "react";
import { X, ArrowRight, Check, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SHARE_PRICE = 1000;
const quickAmounts = [1000, 2500, 5000, 7500, 10000, 12500, 15000];

const countries = [
  { code: "BE", label: "Belgique", flag: "🇧🇪" },
  { code: "LU", label: "Luxembourg", flag: "🇱🇺" },
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "NL", label: "Pays-Bas", flag: "🇳🇱" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InvestSubscriptionModal({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [amount, setAmount] = useState(5000);
  const [country, setCountry] = useState("BE");

  // Step 2
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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("invest_subscriptions").insert({
        amount,
        shares,
        country,
        tax_reduction: taxReduction,
        net_cost: netCost,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim() || null,
        address: address.trim(),
        postal_code: postalCode.trim(),
        city: city.trim(),
        national_number: nationalNumber.trim() || null,
      });
      if (error) throw error;
      toast.success("Souscription envoyée ! Notre équipe vous recontactera sous 48h.");
      onClose();
      setStep(1);
    } catch {
      toast.error("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCountry = countries.find(c => c.code === country);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Souscrire au capital de MediKong</h2>
            <p className="text-sm text-muted-foreground mt-1">Complétez votre souscription en quelques minutes</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg transition-colors">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 px-6 pb-5">
          {[
            { n: 1, label: "Montant" },
            { n: 2, label: "Coordonnées" },
            { n: 3, label: "Récapitulatif" },
          ].map((s, i) => (
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
          {/* STEP 1: Montant */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Montant de votre investissement</p>
                <p className="text-center">
                  <span className="text-4xl font-bold text-foreground">{amount.toLocaleString("fr-BE")} €</span>
                </p>
                <p className="text-center text-sm text-muted-foreground mt-1">{shares} parts à {SHARE_PRICE.toLocaleString("fr-BE")} € chacune</p>
              </div>

              {/* Slider */}
              <div className="relative h-2 rounded-full bg-accent">
                <div className="absolute inset-y-0 left-0 rounded-full bg-mk-green" style={{ width: `${pct}%` }} />
                <input type="range" min={1000} max={15000} step={500} value={amount} onChange={e => setAmount(+e.target.value)}
                  className="absolute inset-0 w-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mk-green [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-mk-green [&::-moz-range-thumb]:border-0" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 000 €</span><span>15 000 €</span>
              </div>

              {/* Quick amounts */}
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map(a => (
                  <button key={a} onClick={() => setAmount(a)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${amount === a ? "bg-mk-blue text-white border-transparent" : "bg-white text-foreground border-border hover:bg-accent"}`}>
                    {a.toLocaleString("fr-BE")} €
                  </button>
                ))}
              </div>

              {/* Country */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Pays de résidence fiscale</p>
                <select value={country} onChange={e => setCountry(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-white">
                  {countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
                </select>
              </div>

              {/* Tax Shelter card */}
              <div className="border border-mk-green/30 rounded-xl p-4 bg-mk-green/5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-mk-green" />
                  <span className="text-sm font-bold text-mk-green">Tax Shelter – Réduction d'impôt 45%</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Investissement</span><span className="font-medium">{amount.toLocaleString("fr-BE")} €</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Montant éligible Tax Shelter</span><span className="font-medium">{(isTaxShelterEligible ? amount : 0).toLocaleString("fr-BE")} €</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Réduction fiscale (45%)</span><span className="font-semibold text-mk-green">- {taxReduction.toLocaleString("fr-BE")} €</span></div>
                  <div className="flex justify-between border-t border-border pt-2 mt-2"><span className="font-bold">Coût réel net</span><span className="font-bold text-mk-green text-lg">{netCost.toLocaleString("fr-BE")} €</span></div>
                  {isTaxShelterEligible && taxShelterRemaining > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Solde Tax Shelter disponible</span><span className="font-medium text-mk-green">{taxShelterRemaining.toLocaleString("fr-BE")} €</span></div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Éligible de 5 000 € à 15 000 € / an.{" "}
                  <a href="https://economie.fgov.be/fr/themes/entreprises/pme-et-independants-en/tax-shelter" target="_blank" rel="noopener noreferrer" className="text-mk-green hover:underline">Infos officielles</a>
                </p>
              </div>

              <button onClick={() => setStep(2)} className="w-full flex items-center justify-center gap-2 bg-mk-green text-white py-3.5 rounded-xl font-semibold text-sm hover:brightness-110 transition-all">
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: Coordonnées */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">Prénom *</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Nom *</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@exemple.be" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Téléphone *</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+32 470 12 34 56" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Société <span className="text-muted-foreground font-normal">(optionnel)</span></label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Ma société SA" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Adresse *</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rue de la Loi 16" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">Code postal *</label>
                  <input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="1000" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Ville *</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Bruxelles" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Numéro national <span className="text-muted-foreground font-normal">(Requis pour l'attestation Tax Shelter)</span></label>
                <input value={nationalNumber} onChange={e => setNationalNumber(e.target.value)} placeholder="85.01.15-001.23" className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent transition-colors">Retour</button>
                <button onClick={() => canStep2 && setStep(3)} disabled={!canStep2}
                  className="flex-1 flex items-center justify-center gap-2 bg-mk-green text-white py-3 rounded-xl font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  Continuer <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Récapitulatif */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📝</span>
                  <span className="text-sm font-bold text-foreground">Récapitulatif de votre souscription</span>
                </div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Parts MediKong SRL</p>
                    <p className="text-xs text-muted-foreground">{shares} parts × {SHARE_PRICE.toLocaleString("fr-BE")} €</p>
                  </div>
                  <span className="text-lg font-bold text-foreground">{amount.toLocaleString("fr-BE")} €</span>
                </div>
                {taxReduction > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-mk-green/10 text-mk-green text-xs font-bold px-2 py-0.5 rounded-full">Tax Shelter 45%</span>
                      <span className="text-sm text-muted-foreground">Réduction d'impôt</span>
                    </div>
                    <span className="text-sm font-semibold text-mk-green">- {taxReduction.toLocaleString("fr-BE")} €</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-border pt-2 mt-2">
                  <span className="font-bold text-foreground">Coût réel net</span>
                  <span className="text-xl font-bold text-mk-green">{netCost.toLocaleString("fr-BE")} €</span>
                </div>
              </div>

              {/* Contact info */}
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">👤</span>
                  <span className="text-sm font-bold text-foreground">Vos coordonnées</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
                  <div><p className="text-muted-foreground text-xs">Nom</p><p className="font-medium">{firstName} {lastName}</p></div>
                  <div><p className="text-muted-foreground text-xs">Email</p><p className="font-medium">{email}</p></div>
                  <div><p className="text-muted-foreground text-xs">Téléphone</p><p className="font-medium">{phone}</p></div>
                  <div><p className="text-muted-foreground text-xs">Pays</p><p className="font-medium">{selectedCountry?.flag} {selectedCountry?.label}</p></div>
                  <div><p className="text-muted-foreground text-xs">Adresse</p><p className="font-medium">{address}, {postalCode} {city}</p></div>
                  {company && <div><p className="text-muted-foreground text-xs">Société</p><p className="font-medium">{company}</p></div>}
                  {nationalNumber && <div><p className="text-muted-foreground text-xs">Numéro national</p><p className="font-medium">{nationalNumber}</p></div>}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent transition-colors">Modifier</button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-mk-green text-white py-3 rounded-xl font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50">
                  {submitting ? "Envoi..." : "Confirmer ma souscription"} {!submitting && <ArrowRight size={16} />}
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                En confirmant, vous serez recontacté par notre équipe pour finaliser la signature et le virement. Aucun prélèvement automatique ne sera effectué.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
