import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Package, TrendingDown, Truck, Shield, ArrowRight, Clock, Users, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoHorizontal from "@/assets/logo-medikong.png";

const steps = [
  { icon: Package, title: "Publiez vos surplus", desc: "Uploadez votre fichier Excel avec vos produits en surstock, proche péremption ou emballage abîmé." },
  { icon: Users, title: "On diffuse aux acheteurs", desc: "MediKong envoie vos opportunités à un réseau qualifié de pharmaciens belges intéressés." },
  { icon: CheckCircle, title: "Vendez rapidement", desc: "L'acheteur clique 'Je prends' ou fait une contre-offre. La vente est conclue en quelques clics." },
  { icon: Truck, title: "Logistique simplifiée", desc: "Enlèvement sur place ou forfait livraison MediKong. Vous n'avez rien à gérer." },
];

const benefits = [
  { icon: TrendingDown, title: "Récupérez votre investissement", desc: "Plutôt que de détruire vos invendus, récupérez une partie de votre investissement.", color: "#00B85C" },
  { icon: Clock, title: "Rapide et simple", desc: "Un fichier Excel, un upload, et vos offres sont en ligne en quelques minutes.", color: "#1C58D9" },
  { icon: Shield, title: "100% conforme", desc: "Validation automatique des DLU, traçabilité complète et conformité réglementaire.", color: "#8B5CF6" },
  { icon: Users, title: "Réseau qualifié", desc: "Vos produits sont proposés uniquement à des pharmaciens vérifiés en Belgique.", color: "#F59E0B" },
];

export default function RestockLandingPage() {
  return (
    <Layout>
      <div className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-to-br from-[#1C58D9] via-[#1549B8] to-[#0F3A8A] text-white py-16 md:py-24">
          <div className="mk-container">
            <div className="max-w-3xl mx-auto text-center">
              <div className="flex items-center justify-center gap-2 mb-6">
                <img src={logoHorizontal} alt="MediKong" className="h-12 brightness-0 invert" />
                <span className="text-[#00B85C] font-bold text-2xl" style={{ fontFamily: "'DM Sans', sans-serif" }}>ReStock</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                La marketplace de déstockage entre pharmaciens belges
              </h1>
              <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                Revendez vos surplus, proches péremptions et emballages abîmés à d'autres pharmaciens. Simple, rapide et conforme.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/restock/seller/new">
                  <Button size="lg" className="bg-[#00B85C] hover:bg-[#00A050] text-white rounded-lg text-base px-8 gap-2">
                    <Package size={18} /> Je vends mes surplus
                  </Button>
                </Link>
                <Link to="/opportunities/demo">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-lg text-base px-8 gap-2 font-semibold">
                    Voir les opportunités <ArrowRight size={16} />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-8 border-b border-[#D0D5DC] bg-white">
          <div className="mk-container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: "100%", label: "Pharmaciens vérifiés" },
                { value: "5%", label: "Commission seulement" },
                { value: "24h", label: "Mise en ligne" },
                { value: "0€", label: "Inscription" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-2xl md:text-3xl font-bold text-[#1C58D9]">{s.value}</p>
                  <p className="text-sm text-[#5C6470]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 bg-[#F7F8FA]">
          <div className="mk-container">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-[#1E252F] mb-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Comment ça marche ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {steps.map((step, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#D0D5DC] p-6 shadow-[0_1px_3px_rgba(0,0,0,.06)] text-center relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#1C58D9] text-white text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#EBF0FB] flex items-center justify-center mx-auto mb-4 mt-2">
                    <step.icon size={24} className="text-[#1C58D9]" />
                  </div>
                  <h3 className="font-semibold text-[#1E252F] mb-2">{step.title}</h3>
                  <p className="text-sm text-[#5C6470]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 bg-white">
          <div className="mk-container">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-[#1E252F] mb-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Pourquoi ReStock ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {benefits.map((b, i) => (
                <div key={i} className="flex gap-4 p-5 rounded-xl border border-[#D0D5DC] bg-[#F7F8FA]">
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: b.color + "15" }}>
                    <b.icon size={22} style={{ color: b.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1E252F] mb-1">{b.title}</h3>
                    <p className="text-sm text-[#5C6470]">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-[#00B85C] to-[#00A050] text-white">
          <div className="mk-container text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Prêt à déstocker ?
            </h2>
            <p className="text-white/80 mb-8 max-w-lg mx-auto">
              Inscrivez-vous gratuitement et commencez à publier vos offres dès maintenant.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/restock/seller/new">
                <Button size="lg" className="bg-white text-[#00B85C] hover:bg-white/90 rounded-lg text-base px-8 font-semibold gap-2">
                  <Package size={18} /> Commencer à vendre
                </Button>
              </Link>
              <Link to="/opportunities/demo">
                <Button size="lg" className="bg-transparent border border-white/30 text-white hover:bg-white/10 rounded-lg text-base px-8 font-semibold">
                  Voir les offres disponibles
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
