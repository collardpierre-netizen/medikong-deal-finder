import { Layout } from "@/components/layout/Layout";
import { FileSearch, Users, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/shared/PageTransition";
import { useState } from "react";
import { toast } from "sonner";

const steps = [
  { icon: <FileSearch size={22} />, title: "Décrivez votre besoin", desc: "Indiquez le produit recherché, les quantités et votre budget estimé." },
  { icon: <Users size={22} />, title: "Nos experts cherchent", desc: "Notre équipe contacte nos 350+ fournisseurs pour trouver la meilleure offre." },
  { icon: <Clock size={22} />, title: "Recevez vos devis sous 48h", desc: "Vous recevez une sélection d'offres vérifiées avec les meilleurs tarifs." },
];

const advantages = [
  "Accès à 350+ fournisseurs vérifiés",
  "Négociation de prix de gros",
  "Vérification qualité incluse",
  "Réponse garantie sous 48h",
  "Sans engagement",
];

export default function SourcingPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", bce: "", description: "", budget: "", urgency: "medium" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Demande envoyée avec succès. Nous vous recontactons sous 48h.");
    setForm({ name: "", email: "", phone: "", company: "", bce: "", description: "", budget: "", urgency: "medium" });
  };

  return (
    <Layout
      title="Sourcing assisté pour professionnels de santé | MediKong"
      description="Service de sourcing assisté MediKong. Trouvez le meilleur fournisseur pour vos fournitures médicales. Devis sous 48h."
    >
      {/* Hero */}
      <section className="py-16 md:py-24 bg-mk-alt/30">
        <div className="mk-container text-center max-w-3xl mx-auto">
          <motion.h1
            className="text-3xl md:text-4xl font-bold text-mk-navy mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Sourcing assisté pour les professionnels de santé
          </motion.h1>
          <motion.p
            className="text-base text-gray-600 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Vous ne trouvez pas un produit ? Notre équipe le source pour vous auprès de nos 350+ fournisseurs.
          </motion.p>
        </div>
      </section>

      {/* Steps */}
      <AnimatedSection className="py-16 md:py-20">
        <div className="mk-container max-w-4xl">
          <h2 className="text-2xl font-bold text-mk-navy mb-10 text-center">Comment ça marche</h2>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <StaggerItem key={s.title} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-mk-blue text-white flex items-center justify-center mx-auto mb-4">
                  {s.icon}
                </div>
                <h3 className="font-bold text-mk-navy mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* Form + Advantages */}
      <AnimatedSection className="py-16 md:py-20 bg-mk-alt/30">
        <div className="mk-container max-w-5xl">
          <div className="grid md:grid-cols-5 gap-10">
            {/* Form */}
            <div className="md:col-span-3">
              <h2 className="text-2xl font-bold text-mk-navy mb-6">Envoyez votre demande</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom complet" className="border border-mk-line rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mk-blue" />
                  <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email professionnel" className="border border-mk-line rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mk-blue" />
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Téléphone" className="border border-mk-line rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mk-blue" />
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Entreprise" className="border border-mk-line rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mk-blue" />
                  <input value={form.bce} onChange={e => setForm({ ...form, bce: e.target.value })} placeholder="Numéro BCE (optionnel)" className="border border-mk-line rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mk-blue" />
                  <input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} placeholder="Budget estimé (EUR)" className="border border-mk-line rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mk-blue" />
                </div>
                <textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Décrivez le produit recherché, les quantités, les spécificités..." rows={4} className="w-full border border-mk-line rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mk-blue" />
                <div>
                  <label className="text-sm font-medium text-mk-navy mb-2 block">Urgence</label>
                  <div className="flex gap-3">
                    {[{ v: "low", l: "Faible" }, { v: "medium", l: "Moyenne" }, { v: "high", l: "Urgente" }].map(u => (
                      <button key={u.v} type="button" onClick={() => setForm({ ...form, urgency: u.v })} className={`px-4 py-2 rounded-lg text-sm border transition-colors ${form.urgency === u.v ? "bg-mk-blue text-white border-mk-blue" : "border-mk-line text-mk-sec hover:border-mk-navy"}`}>
                        {u.l}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full bg-mk-blue text-white font-semibold py-3.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  Envoyer ma demande de sourcing <ArrowRight size={16} />
                </button>
              </form>
            </div>
            {/* Advantages */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold text-mk-navy mb-6">Pourquoi utiliser notre sourcing ?</h3>
              <div className="space-y-4">
                {advantages.map(a => (
                  <div key={a} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-mk-green shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{a}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </Layout>
  );
}
