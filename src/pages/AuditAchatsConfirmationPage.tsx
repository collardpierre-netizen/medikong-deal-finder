import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, ArrowRight, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AuditAchatsConfirmationPage() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Demande reçue — Medikong</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="border-b border-border bg-white">
        <div className="mk-container flex items-center justify-between h-14">
          <Link to="/" className="font-bold text-lg text-primary">MediKong</Link>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="mk-container max-w-2xl">
          <Card className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
              <CheckCircle2 className="text-emerald-700" size={32} />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3">
              Demande reçue — Merci !
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Votre audit personnalisé arrive <strong>sous 48h ouvrées</strong>.
              <br />
              Vous recevrez un email de confirmation à l'adresse{" "}
              <strong className="text-foreground">{email || "indiquée"}</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg">
                <Link to="/catalogue">
                  Explorer le catalogue Medikong
                  <ArrowRight className="ml-2" size={18} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href="https://www.linkedin.com/company/medikong"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Linkedin className="mr-2" size={18} />
                  Suivre Medikong sur LinkedIn
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
