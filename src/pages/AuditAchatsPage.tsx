import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Upload,
  FileText,
  Shield,
  Clock,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoHorizontal from "@/assets/logo-medikong.png";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface FormState {
  pharmacy_name: string;
  pharmacy_apb_number: string;
  pharmacy_address: string;
  pharmacy_city: string;
  pharmacy_postal_code: string;
  pharmacy_country: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
  contact_phone: string;
  additional_notes: string;
}

const initialForm: FormState = {
  pharmacy_name: "",
  pharmacy_apb_number: "",
  pharmacy_address: "",
  pharmacy_city: "",
  pharmacy_postal_code: "",
  pharmacy_country: "BE",
  contact_first_name: "",
  contact_last_name: "",
  contact_email: "",
  contact_phone: "",
  additional_notes: "",
};

export default function AuditAchatsPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid: File[] = [];
    for (const f of arr) {
      if (f.type !== "application/pdf") {
        toast.error(`${f.name} : seuls les PDF sont acceptés`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} : dépasse 10 MB`);
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => {
      const next = [...prev, ...valid].slice(0, MAX_FILES);
      if (prev.length + valid.length > MAX_FILES) {
        toast.warning(`Maximum ${MAX_FILES} fichiers`);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!consent) {
      toast.error("Vous devez accepter le traitement de vos données");
      return;
    }
    if (files.length === 0) {
      toast.error("Ajoutez au moins une facture PDF");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("consent", "true");
      files.forEach((f) => fd.append("pdfs", f, f.name));

      const { data, error } = await supabase.functions.invoke("submit-audit-request", {
        body: fd,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Échec de l'envoi");

      navigate(
        `/audit-achats/confirmation?email=${encodeURIComponent(form.contact_email)}`,
      );
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message ||
          "Une erreur est survenue. Réessayez ou contactez pcoll@medikong.pro",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Audit gratuit de vos achats — Medikong | Économies garanties</title>
        <meta
          name="description"
          content="Pharmaciens : recevez un audit personnalisé de vos achats et découvrez où économiser. 10 min de votre temps, rapport sous 48h. Gratuit, RGPD compliant."
        />
        <meta property="og:title" content="Audit gratuit de vos achats — Medikong" />
        <meta
          property="og:description"
          content="Audit personnalisé de vos achats pharmacie. Rapport sous 48h, sans engagement."
        />
        <link rel="canonical" href="https://medikong.pro/audit-achats" />
      </Helmet>

      {/* Top bar minimal */}
      <header className="border-b border-border bg-white">
        <div className="mk-container flex items-center justify-between h-14">
          <Link to="/" className="flex items-center">
            <img src={logoHorizontal} alt="MediKong" className="h-10" />
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Retour au site
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-to-br from-primary/5 via-white to-emerald-50/30">
        <div className="mk-container py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-4">
              <Sparkles size={14} /> 100 % gratuit · sans engagement
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4 leading-tight">
              Audit gratuit de vos achats pharmacie — <span className="text-primary">économies garanties</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              10 minutes de votre temps. On s'occupe du reste.
              <br />
              Rapport personnalisé sous 48h.
            </p>
            <Button size="lg" onClick={scrollToForm} className="text-base">
              Demander mon audit gratuit
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="hidden md:block"
          >
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-primary/10 to-emerald-100 rounded-3xl p-8 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FileText className="text-emerald-700" size={20} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Rapport d'audit</div>
                      <div className="font-semibold text-sm">Pharmacie Exemple</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Économies potentielles</span>
                      <span className="font-bold text-emerald-700">+ 11 240 €/an</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Produits analysés</span>
                      <span className="font-semibold">50</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sources alternatives</span>
                      <span className="font-semibold">5</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* BÉNÉFICES */}
      <section className="py-16 md:py-20">
        <div className="mk-container">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: CheckCircle2, title: "Économies identifiées", desc: "Découvrez combien vous économiseriez chez d'autres fournisseurs." },
              { icon: Sparkles, title: "Produits overpriced repérés", desc: "Identifiez les produits où votre grossiste actuel est trop cher." },
              { icon: FileText, title: "5 recommandations sourcing", desc: "Recevez des recommandations personnalisées et actionnables." },
            ].map((b, i) => (
              <Card key={i} className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <b.icon className="text-primary" size={22} />
                </div>
                <h3 className="font-bold text-lg mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="py-16 md:py-20 bg-slate-50/50">
        <div className="mk-container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Comment ça marche ?
          </h2>
          <div className="grid md:grid-cols-4 gap-6 md:gap-4">
            {[
              { n: 1, title: "Upload", desc: "Vous uploadez votre dernière facture grossiste (PDF)." },
              { n: 2, title: "Analyse", desc: "On analyse vos 50 produits les plus achetés." },
              { n: 3, title: "Benchmark", desc: "On benchmark vs notre catalogue (450k+ offres)." },
              { n: 4, title: "Rapport", desc: "Rapport personnalisé envoyé sous 48h." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mb-3">
                  {s.n}
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORMULAIRE */}
      <section id="form" ref={formRef} className="py-16 md:py-20">
        <div className="mk-container max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            Demandez votre audit gratuit
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Réponse sous 48h ouvrées · vos données ne sont jamais revendues
          </p>

          <Card className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="pharmacy_name">
                  Nom de la pharmacie <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pharmacy_name"
                  required
                  value={form.pharmacy_name}
                  onChange={update("pharmacy_name")}
                  placeholder="Pharmacie Centrale"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pharmacy_apb_number">N° APB</Label>
                  <Input
                    id="pharmacy_apb_number"
                    value={form.pharmacy_apb_number}
                    onChange={update("pharmacy_apb_number")}
                    placeholder="123456"
                  />
                </div>
                <div>
                  <Label htmlFor="pharmacy_country">Pays</Label>
                  <select
                    id="pharmacy_country"
                    value={form.pharmacy_country}
                    onChange={(e) => setForm((s) => ({ ...s, pharmacy_country: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="BE">Belgique</option>
                    <option value="FR">France</option>
                    <option value="LU">Luxembourg</option>
                    <option value="NL">Pays-Bas</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="pharmacy_address">Adresse</Label>
                <Input
                  id="pharmacy_address"
                  value={form.pharmacy_address}
                  onChange={update("pharmacy_address")}
                  placeholder="Rue de la Pharmacie 12"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pharmacy_city">Ville</Label>
                  <Input
                    id="pharmacy_city"
                    value={form.pharmacy_city}
                    onChange={update("pharmacy_city")}
                    placeholder="Bruxelles"
                  />
                </div>
                <div>
                  <Label htmlFor="pharmacy_postal_code">Code postal</Label>
                  <Input
                    id="pharmacy_postal_code"
                    value={form.pharmacy_postal_code}
                    onChange={update("pharmacy_postal_code")}
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="border-t pt-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_first_name">
                      Prénom <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="contact_first_name"
                      required
                      value={form.contact_first_name}
                      onChange={update("contact_first_name")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_last_name">
                      Nom <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="contact_last_name"
                      required
                      value={form.contact_last_name}
                      onChange={update("contact_last_name")}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="contact_email">
                  Email professionnel <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  required
                  value={form.contact_email}
                  onChange={update("contact_email")}
                  placeholder="vous@pharmacie.be"
                />
              </div>

              <div>
                <Label htmlFor="contact_phone">Téléphone</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={form.contact_phone}
                  onChange={update("contact_phone")}
                  placeholder="+32 470 12 34 56"
                  pattern="^[+0-9 .()-]{6,20}$"
                />
              </div>

              {/* Drag & drop */}
              <div>
                <Label>
                  Factures grossiste (PDF) <span className="text-destructive">*</span>
                </Label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-1.5 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    dragOver ? "border-primary bg-primary/5" : "border-input hover:border-primary/50"
                  }`}
                >
                  <Upload className="mx-auto mb-2 text-muted-foreground" size={28} />
                  <p className="text-sm font-medium">
                    Glissez votre facture PDF ici (max 10 MB)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ou cliquez pour parcourir · jusqu'à {MAX_FILES} fichiers
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>

                {files.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <FileText size={16} className="text-primary shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ({(f.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive p-1"
                          aria-label="Retirer"
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <Label htmlFor="additional_notes">Informations complémentaires</Label>
                <Textarea
                  id="additional_notes"
                  rows={3}
                  value={form.additional_notes}
                  onChange={update("additional_notes")}
                  placeholder="Volume mensuel, spécialités, contraintes…"
                />
              </div>

              {/* RGPD */}
              <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(!!v)}
                  className="mt-0.5"
                />
                <label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  J'autorise Medikong à analyser cette facture à des fins d'audit.
                  Mes données sont conservées 12 mois max et jamais revendues.{" "}
                  <Link to="/politique-confidentialite" className="text-primary underline">
                    Lire notre politique de confidentialité
                  </Link>
                  .
                </label>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Envoi en cours…
                  </>
                ) : (
                  "Recevoir mon audit gratuit"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <Shield size={12} /> Stockage chiffré · accès limité · RGPD compliant
              </p>
            </form>
          </Card>
        </div>
      </section>

      {/* PREUVES SOCIALES */}
      <section className="py-16 bg-slate-50/50">
        <div className="mk-container text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-2">Ils nous font confiance</h2>
          <p className="text-sm text-muted-foreground italic">
            Bientôt : témoignages pharmaciens
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20">
        <div className="mk-container max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Questions fréquentes
          </h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger>Est-ce vraiment gratuit ?</AccordionTrigger>
              <AccordionContent>
                Oui, totalement gratuit et sans engagement.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>Mes données sont-elles sécurisées ?</AccordionTrigger>
              <AccordionContent>
                Stockage chiffré, accès limité à l'équipe d'analyse Medikong.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>Combien de temps pour le rapport ?</AccordionTrigger>
              <AccordionContent>
                48 heures ouvrées après réception de votre demande.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger>Vais-je recevoir du spam ?</AccordionTrigger>
              <AccordionContent>
                Non, nous nous engageons à ne pas vous envoyer de spam.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q5">
              <AccordionTrigger>Puis-je supprimer mes données ?</AccordionTrigger>
              <AccordionContent>
                Oui, à tout moment. Écrivez-nous à pcoll@medikong.pro.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer minimal */}
      <footer className="border-t py-8 bg-slate-50">
        <div className="mk-container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock size={14} /> Réponse sous 48h · pcoll@medikong.pro
          </div>
          <div className="flex items-center gap-4">
            <Link to="/cgv" className="hover:text-foreground">CGU</Link>
            <Link to="/politique-confidentialite" className="hover:text-foreground">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
