import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";

const INVESTOR_TYPES = [
  "Personne physique",
  "Société / holding",
  "Family office",
  "Fonds / investisseur institutionnel",
  "Autre",
];

const AMOUNT_RANGES = [
  "2 500 € – 5 000 €",
  "5 000 € – 25 000 €",
  "25 000 € – 50 000 €",
  "50 000 € – 100 000 €",
  "Plus de 100 000 €",
];

export default function InvestContactPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [investorType, setInvestorType] = useState("");
  const [amountRange, setAmountRange] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing: string[] = [];
  if (!firstName.trim()) missing.push("Prénom");
  if (!lastName.trim()) missing.push("Nom");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) missing.push("E-mail valide");
  if (!consent) missing.push("Consentement");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (missing.length > 0) {
      setError(`Merci de compléter : ${missing.join(", ")}.`);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "submit-investor-inquiry",
        {
          body: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            company: company.trim(),
            investorType,
            amountRange,
            message: message.trim(),
            consent,
          },
        },
      );
      if (fnError) throw fnError;
      if (data && (data as any).error) throw new Error((data as any).message || "Envoi impossible");
      setSent(true);
      toast.success("Demande envoyée");
    } catch (err: any) {
      setError(
        err?.message ||
          "L'envoi a échoué. Réessayez ou écrivez-nous à pcoll@medikong.pro.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container max-w-3xl py-12">
        <Link
          to="/invest"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la page investisseurs
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          Contact investisseurs
        </h1>
        <p className="mt-3 text-muted-foreground">
          Vous souhaitez en savoir plus sur la levée de fonds MediKong ? Laissez-nous
          vos coordonnées : nous vous envoyons le dossier investisseur et répondons à
          vos questions sous 2 jours ouvrables.
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Ticket minimum 2 500 €
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Tax Shelter dès 5 000 €
          </span>
          <span className="inline-flex items-center gap-2">
            <Mail className="h-4 w-4" /> pcoll@medikong.pro
          </span>
        </div>

        {sent ? (
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <h2 className="text-xl font-semibold">Demande envoyée</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Merci ! Vous recevez un e-mail de confirmation. Notre équipe vous
                recontacte sous 2 jours ouvrables avec le dossier investisseur.
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/invest">Revenir à la page investisseurs</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Demande d'informations</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+32 ..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Société (optionnel)</Label>
                    <Input
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Profil investisseur</Label>
                    <Select value={investorType} onValueChange={setInvestorType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {INVESTOR_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Montant envisagé</Label>
                  <Select value={amountRange} onValueChange={setAmountRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une fourchette" />
                    </SelectTrigger>
                    <SelectContent>
                      {AMOUNT_RANGES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Votre message / vos questions</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Dossier investisseur, Tax Shelter, calendrier de la levée..."
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v === true)}
                  />
                  <Label
                    htmlFor="consent"
                    className="text-sm font-normal leading-relaxed text-muted-foreground"
                  >
                    J'accepte que MediKong (Balooh SRL) utilise mes coordonnées pour
                    répondre à ma demande d'informations investisseurs. *
                  </Label>
                </div>

                <Button type="submit" size="lg" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Envoyer ma demande
                </Button>
                <p className="text-xs text-muted-foreground">
                  Ceci n'est pas une souscription : aucun engagement n'est pris à ce
                  stade.
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
