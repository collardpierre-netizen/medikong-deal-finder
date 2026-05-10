import { Layout } from "@/components/layout/Layout";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ShieldCheck, Sparkles, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Supplier = "febelco" | "cerp" | "pharma_belgium" | "other";
type Status = "processing" | "done" | "failed" | "no_match";

interface SimulationStatus {
  id: string;
  status: Status;
  total_lines: number | null;
  matched_lines: number | null;
  match_rate: number | null;
  source_total_excl_vat: number | null;
  medikong_total_excl_vat: number | null;
  savings_amount: number | null;
  savings_pct: number | null;
  error_message: string | null;
  email_sent_at: string | null;
}

interface SimulationLine {
  id: string;
  line_number: number | null;
  detected_name: string | null;
  detected_brand: string | null;
  detected_cnk: string | null;
  detected_quantity: number | null;
  detected_unit_price_excl_vat: number | null;
  matched_product_id: string | null;
  match_method: string | null;
  match_confidence: number | null;
  medikong_min_price_excl_vat: number | null;
  medikong_supplier_count: number | null;
  line_savings: number | null;
  line_savings_pct: number | null;
  matched_product?: { name: string | null; slug: string | null } | null;
}

const SUPPLIERS: { value: Supplier; label: string }[] = [
  { value: "febelco", label: "Febelco" },
  { value: "cerp", label: "CERP" },
  { value: "pharma_belgium", label: "Pharma Belgium" },
  { value: "other", label: "Autre" },
];

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "text/csv", "application/vnd.ms-excel"];
const MAX_SIZE = 10 * 1024 * 1024;

const fmtMoney = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("fr-BE", { style: "currency", currency: "EUR" }) : "—";

export default function EconomiesPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [supplier, setSupplier] = useState<Supplier>("febelco");
  const [file, setFile] = useState<File | null>(null);
  const [identity, setIdentity] = useState({ email: "", pharmacy_name: "", city: "", vat_number: "" });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [simId, setSimId] = useState<string | null>(null);
  const [sim, setSim] = useState<SimulationStatus | null>(null);
  const pollRef = useRef<number | null>(null);

  // Polling
  useEffect(() => {
    if (!simId || sim?.status === "done" || sim?.status === "failed" || sim?.status === "no_match") {
      if (pollRef.current) window.clearInterval(pollRef.current);
      return;
    }
    const tick = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-savings-upload?id=${simId}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        if (!res.ok) return;
        const data = (await res.json()) as SimulationStatus;
        setSim(data);
        if (data.status !== "processing") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStep(4);
        }
      } catch (err) {
        console.error("[economies] polling error", err);
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [simId, sim?.status]);

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Format non supporté. PDF, JPG, PNG ou CSV uniquement.");
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error("Fichier trop lourd (max 10 Mo).");
      return;
    }
    setFile(f);
    setStep(3);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Veuillez ajouter votre bon de commande.");
    if (!consent) return toast.error("Vous devez accepter le traitement de vos données.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) return toast.error("Email invalide.");

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source_supplier", supplier);
      fd.append("email", identity.email);
      fd.append("pharmacy_name", identity.pharmacy_name);
      fd.append("city", identity.city);
      fd.append("vat_number", identity.vat_number);
      fd.append("consent_given", "true");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-savings-upload`;
      const res = await fetch(url, {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error === "consent_required" ? "Consentement requis" : "Une erreur est survenue.");
        return;
      }
      setSimId(data.id);
      setSim({
        id: data.id, status: "processing",
        total_lines: null, matched_lines: null, match_rate: null,
        source_total_excl_vat: null, medikong_total_excl_vat: null,
        savings_amount: null, savings_pct: null, error_message: null, email_sent_at: null,
      });
      setStep(4);
    } catch (err) {
      console.error("[economies] submit error", err);
      toast.error("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReport = async () => {
    if (!simId) return;
    toast.info("Génération du rapport PDF en cours… vous le recevrez par email d'ici quelques minutes.");
    // Lot 4 : edge function generate-savings-report (à implémenter)
    try {
      await supabase.functions.invoke("generate-savings-report", { body: { simulation_id: simId } });
    } catch (err) {
      console.error("[economies] report request error", err);
    }
  };

  return (
    <Layout
      title="Calculateur d'économies grossiste pharma | MediKong"
      description="Comparez votre dernier bon de commande Febelco, CERP ou Pharma Belgium avec les prix MediKong. Résultat en 60 secondes, gratuit, sans engagement."
    >
      <section className="py-12 md:py-16 bg-gradient-to-b from-mk-alt/40 to-white">
        <div className="mk-container max-w-3xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-mk-navy mb-3"
          >
            Calculez vos économies en 60 secondes
          </motion.h1>
          <p className="text-mk-text/70 text-base md:text-lg mb-8 max-w-2xl mx-auto">
            Glissez votre dernier bon de commande Febelco, CERP ou Pharma Belgium.
            Nous comparons chaque ligne avec les prix MediKong et calculons vos économies potentielles.
            <span className="block mt-2 text-sm font-medium text-mk-blue">100% gratuit · sans engagement · résultat immédiat.</span>
          </p>

          <div className="bg-white border border-mk-border rounded-xl shadow-sm p-6 md:p-8 text-left">
            {/* Stepper */}
            <div className="flex items-center justify-between mb-6 text-xs font-medium">
              {["1. Grossiste", "2. Bon de commande", "3. Vos infos", "4. Résultat"].map((label, i) => (
                <div key={label} className={`flex-1 text-center ${step > i ? "text-mk-blue" : step === i + 1 ? "text-mk-navy" : "text-mk-text/40"}`}>
                  {label}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h2 className="font-semibold text-mk-navy mb-3">Quel grossiste utilisez-vous ?</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {SUPPLIERS.map((s) => (
                      <button key={s.value} type="button"
                        onClick={() => { setSupplier(s.value); setStep(2); }}
                        className={`border rounded-lg p-4 text-left transition ${supplier === s.value ? "border-mk-blue bg-mk-blue/5" : "border-mk-border hover:border-mk-blue/40"}`}>
                        <div className="font-medium text-mk-navy">{s.label}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h2 className="font-semibold text-mk-navy mb-3">Déposez votre bon de commande</h2>
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0] ?? null); }}
                    className="block border-2 border-dashed border-mk-blue/40 rounded-lg p-8 text-center cursor-pointer hover:bg-mk-blue/5 transition"
                  >
                    <Upload className="mx-auto mb-3 text-mk-blue" />
                    <div className="font-medium text-mk-navy mb-1">Glissez votre fichier ici</div>
                    <div className="text-xs text-mk-text/60">PDF, JPG, PNG ou CSV · max 10 Mo</div>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.csv"
                      onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <button type="button" onClick={() => setStep(1)} className="text-xs text-mk-text/60 mt-3 hover:underline">← changer de grossiste</button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.form key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={submit} className="space-y-4">
                  {file && (
                    <div className="flex items-center gap-2 bg-mk-alt/30 rounded p-3 text-sm">
                      <FileText size={16} className="text-mk-blue" />
                      <span className="font-medium truncate flex-1">{file.name}</span>
                      <button type="button" onClick={() => { setFile(null); setStep(2); }} className="text-xs text-mk-blue hover:underline">changer</button>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-3">
                    <input required type="email" placeholder="Email professionnel *"
                      value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
                      className="border border-mk-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-mk-blue" />
                    <input type="text" placeholder="Nom de la pharmacie"
                      value={identity.pharmacy_name} onChange={(e) => setIdentity({ ...identity, pharmacy_name: e.target.value })}
                      className="border border-mk-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-mk-blue" />
                    <input type="text" placeholder="Ville"
                      value={identity.city} onChange={(e) => setIdentity({ ...identity, city: e.target.value })}
                      className="border border-mk-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-mk-blue" />
                    <input type="text" placeholder="N° TVA (BE...)"
                      value={identity.vat_number} onChange={(e) => setIdentity({ ...identity, vat_number: e.target.value })}
                      className="border border-mk-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-mk-blue" />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-mk-text/70 cursor-pointer">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                    <span>
                      J'accepte que MediKong analyse mon bon de commande pour calculer mes économies, m'envoie le rapport par email,
                      et conserve une version anonymisée des prix observés (RGPD). Je peux supprimer ma simulation à tout moment.
                    </span>
                  </label>
                  <button type="submit" disabled={submitting}
                    className="w-full bg-mk-blue text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-mk-blue/90 disabled:opacity-50 transition">
                    {submitting ? <Loader2 className="inline animate-spin mr-2" size={14} /> : <Sparkles className="inline mr-2" size={14} />}
                    {submitting ? "Envoi en cours…" : "Calculer mes économies"}
                  </button>
                </motion.form>
              )}

              {step === 4 && (
                <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {(!sim || sim.status === "processing") && (
                    <div className="text-center py-10">
                      <Loader2 className="mx-auto mb-3 animate-spin text-mk-blue" size={32} />
                      <div className="font-semibold text-mk-navy mb-1">Analyse en cours…</div>
                      <div className="text-sm text-mk-text/60">OCR du bon de commande, matching catalogue, calcul des économies. ~30 à 60 secondes.</div>
                    </div>
                  )}

                  {sim?.status === "done" && (
                    <div>
                      <div className="text-center mb-6">
                        <CheckCircle2 className="mx-auto text-green-600 mb-2" size={40} />
                        <h2 className="text-2xl font-bold text-mk-navy">Vos économies potentielles</h2>
                      </div>
                      <div className="bg-gradient-to-br from-mk-blue to-mk-navy text-white rounded-xl p-6 text-center mb-4">
                        <div className="text-xs uppercase tracking-wider opacity-80 mb-1">Sur ce seul bon de commande</div>
                        <div className="text-4xl font-bold mb-1">{fmtMoney(sim.savings_amount)}</div>
                        <div className="text-sm opacity-90">soit {sim.savings_pct?.toFixed(1) ?? "—"} % de moins</div>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm mb-6">
                        <div className="bg-mk-alt/30 rounded p-3">
                          <dt className="text-xs text-mk-text/60">Lignes analysées</dt>
                          <dd className="font-semibold text-mk-navy">{sim.matched_lines ?? 0} / {sim.total_lines ?? 0}</dd>
                        </div>
                        <div className="bg-mk-alt/30 rounded p-3">
                          <dt className="text-xs text-mk-text/60">Taux de correspondance</dt>
                          <dd className="font-semibold text-mk-navy">{((sim.match_rate ?? 0) * 100).toFixed(0)} %</dd>
                        </div>
                        <div className="bg-mk-alt/30 rounded p-3">
                          <dt className="text-xs text-mk-text/60">Total grossiste</dt>
                          <dd className="font-semibold text-mk-navy">{fmtMoney(sim.source_total_excl_vat)}</dd>
                        </div>
                        <div className="bg-mk-alt/30 rounded p-3">
                          <dt className="text-xs text-mk-text/60">Total MediKong</dt>
                          <dd className="font-semibold text-mk-navy">{fmtMoney(sim.medikong_total_excl_vat)}</dd>
                        </div>
                      </dl>
                      <button onClick={sendReport}
                        className="w-full bg-mk-blue text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-mk-blue/90 transition">
                        <Mail className="inline mr-2" size={14} />
                        Recevoir le rapport PDF complet par email
                      </button>
                      <p className="text-xs text-mk-text/60 text-center mt-2">
                        Détail ligne par ligne · économie annualisée · valable 30 jours
                      </p>
                    </div>
                  )}

                  {sim?.status === "no_match" && (
                    <div className="text-center py-8">
                      <AlertCircle className="mx-auto text-amber-600 mb-2" size={32} />
                      <div className="font-semibold text-mk-navy mb-1">Aucune ligne reconnue</div>
                      <div className="text-sm text-mk-text/60 mb-4">{sim.error_message || "Le format de votre fichier n'a pas pu être lu. Essayez un PDF plus net ou un export CSV."}</div>
                      <button onClick={() => { setSim(null); setSimId(null); setStep(2); setFile(null); }}
                        className="text-mk-blue text-sm font-medium hover:underline">← Réessayer avec un autre fichier</button>
                    </div>
                  )}

                  {sim?.status === "failed" && (
                    <div className="text-center py-8">
                      <AlertCircle className="mx-auto text-red-600 mb-2" size={32} />
                      <div className="font-semibold text-mk-navy mb-1">Une erreur est survenue</div>
                      <div className="text-sm text-mk-text/60 mb-4">{sim.error_message || "Notre système n'a pas pu traiter votre fichier."}</div>
                      <button onClick={() => { setSim(null); setSimId(null); setStep(2); setFile(null); }}
                        className="text-mk-blue text-sm font-medium hover:underline">← Réessayer</button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Trust banner */}
          <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-xs text-mk-text/70">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-mk-blue" /> Données chiffrées · RGPD</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-mk-blue" /> Aucune revente</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles size={14} className="text-mk-blue" /> Suppression sur simple demande</span>
          </div>
        </div>
      </section>
    </Layout>
  );
}
