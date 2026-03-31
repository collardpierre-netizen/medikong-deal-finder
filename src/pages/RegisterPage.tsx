import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [country, setCountry] = useState("Belgique");
  const [sector, setSector] = useState("Pharmacie");
  const [profileId, setProfileId] = useState("");
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (supabase as any).from("user_profiles").select("id, name").eq("is_active", true).order("display_order").then(({ data }: any) => {
      if (data) {
        setProfiles(data);
        const pharmacien = data.find((p: any) => p.name.toLowerCase().includes("pharmacien"));
        if (pharmacien) setProfileId(pharmacien.id);
        else if (data.length) setProfileId(data[0].id);
      }
    });
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    const { error, data: authData } = await signUp(email, password, {
      full_name: fullName,
      phone,
      company_name: companyName,
      vat_number: vatNumber,
      country,
      sector,
    });
    if (!error && authData?.user && profileId) {
      await (supabase as any).from("user_profile_assignments").upsert({
        user_id: authData.user.id,
        profile_id: profileId,
      });
    }
    setLoading(false);
    if (error) {
      toast({ title: "Erreur d'inscription", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Compte cree !", description: "Verifiez votre email pour confirmer votre inscription." });
      navigate("/connexion");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mk-alt">
      <div className="w-full max-w-[400px] p-8">
        <div className="text-center mb-8">
          <Link to="/" className="flex items-center justify-center mb-4">
            <img src={logoDark} alt="MediKong.pro" className="h-12" />
          </Link>
          <h1 className="text-xl font-bold text-mk-navy">Creer votre compte professionnel</h1>
          <div className="flex justify-center gap-2 mt-3">
            <div className={`w-8 h-1 rounded-full ${step >= 1 ? "bg-mk-navy" : "bg-mk-line"}`} />
            <div className={`w-8 h-1 rounded-full ${step >= 2 ? "bg-mk-navy" : "bg-mk-line"}`} />
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div><label className="text-xs text-mk-sec mb-1 block">Nom complet</label><input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Email</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Telephone</label><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" placeholder="+32" /></div>
            <div>
              <label className="text-xs text-mk-sec mb-1 block">Mot de passe</label>
              <div className="relative">
                <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-mk-sec hover:text-mk-navy transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!email || !password || !fullName} className="w-full bg-mk-navy text-white font-bold py-3 rounded-md text-sm disabled:opacity-50">Continuer</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><label className="text-xs text-mk-sec mb-1 block">Nom entreprise</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Numero TVA</label><input value={vatNumber} onChange={e => setVatNumber(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" placeholder="BE 0XXX.XXX.XXX" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Pays</label>
              <select value={country} onChange={e => setCountry(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm"><option>Belgique</option><option>France</option><option>Suisse</option></select>
            </div>
            <div><label className="text-xs text-mk-sec mb-1 block">Profil professionnel</label>
              <select value={profileId} onChange={e => setProfileId(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm">
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-mk-sec mb-1 block">Secteur d'activite</label>
              <select value={sector} onChange={e => setSector(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm"><option>Pharmacie</option><option>Hopital</option><option>Maison de repos</option><option>Distributeur</option><option>Autre</option></select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-mk-navy text-mk-navy font-bold py-3 rounded-md text-sm">Retour</button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-mk-navy text-white font-bold py-3 rounded-md text-sm disabled:opacity-50">
                {loading ? "Creation..." : "Creer mon compte"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-mk-sec mt-6">
          Deja inscrit ? <Link to="/connexion" className="text-mk-blue font-medium">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [country, setCountry] = useState("Belgique");
  const [sector, setSector] = useState("Pharmacie");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async () => {
    setLoading(true);
    const { error } = await signUp(email, password, {
      full_name: fullName,
      phone,
      company_name: companyName,
      vat_number: vatNumber,
      country,
      sector,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erreur d'inscription", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Compte cree !", description: "Verifiez votre email pour confirmer votre inscription." });
      navigate("/connexion");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mk-alt">
      <div className="w-full max-w-[400px] p-8">
        <div className="text-center mb-8">
          <Link to="/" className="flex items-center justify-center mb-4">
            <img src={logoDark} alt="MediKong.pro" className="h-12" />
          </Link>
          <h1 className="text-xl font-bold text-mk-navy">Creer votre compte professionnel</h1>
          <div className="flex justify-center gap-2 mt-3">
            <div className={`w-8 h-1 rounded-full ${step >= 1 ? "bg-mk-navy" : "bg-mk-line"}`} />
            <div className={`w-8 h-1 rounded-full ${step >= 2 ? "bg-mk-navy" : "bg-mk-line"}`} />
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div><label className="text-xs text-mk-sec mb-1 block">Nom complet</label><input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Email</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Telephone</label><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" placeholder="+32" /></div>
            <div>
              <label className="text-xs text-mk-sec mb-1 block">Mot de passe</label>
              <div className="relative">
                <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-mk-sec hover:text-mk-navy transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!email || !password || !fullName} className="w-full bg-mk-navy text-white font-bold py-3 rounded-md text-sm disabled:opacity-50">Continuer</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><label className="text-xs text-mk-sec mb-1 block">Nom entreprise</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Numero TVA</label><input value={vatNumber} onChange={e => setVatNumber(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" placeholder="BE 0XXX.XXX.XXX" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Pays</label>
              <select value={country} onChange={e => setCountry(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm"><option>Belgique</option><option>France</option><option>Suisse</option></select>
            </div>
            <div><label className="text-xs text-mk-sec mb-1 block">Secteur d'activite</label>
              <select value={sector} onChange={e => setSector(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm"><option>Pharmacie</option><option>Hopital</option><option>Maison de repos</option><option>Distributeur</option><option>Autre</option></select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-mk-navy text-mk-navy font-bold py-3 rounded-md text-sm">Retour</button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-mk-navy text-white font-bold py-3 rounded-md text-sm disabled:opacity-50">
                {loading ? "Creation..." : "Creer mon compte"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-mk-sec mt-6">
          Deja inscrit ? <Link to="/connexion" className="text-mk-blue font-medium">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
