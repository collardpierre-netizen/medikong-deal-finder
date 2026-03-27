import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import {
  Settings, Building2, Percent, Mail, Webhook, Key, CreditCard, ShieldCheck,
} from "lucide-react";

const sidebarItems = [
  { key: "general", label: "Général", icon: Building2 },
  { key: "commissions", label: "Commissions", icon: Percent },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "apikeys", label: "API Keys", icon: Key },
  { key: "paiements", label: "Paiements", icon: CreditCard },
  { key: "securite", label: "Sécurité", icon: ShieldCheck },
];

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "#F1F5F9" }}>
    <span className="text-[12px] font-medium" style={{ color: "#616B7C" }}>{label}</span>
    <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{value}</span>
  </div>
);

const AdminParametres = () => {
  const [section, setSection] = useState("general");

  return (
    <div>
      <AdminTopBar title="Paramètres" subtitle="Configuration de la plateforme" />

      <div className="flex gap-5">
        {/* Settings sidebar */}
        <div className="w-[200px] shrink-0 bg-white rounded-lg border p-3" style={{ borderColor: "#E2E8F0" }}>
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[12px] font-medium transition-colors mb-0.5"
              style={{
                backgroundColor: section === item.key ? "#EFF6FF" : "transparent",
                color: section === item.key ? "#1B5BDA" : "#616B7C",
              }}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-lg border p-6" style={{ borderColor: "#E2E8F0" }}>
          {section === "general" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Informations générales</h3>
              <Field label="Nom de la plateforme" value="MediKong.pro" />
              <Field label="Entité juridique" value="Balooh SRL" />
              <Field label="N° TVA" value="BE 1005.771.323" />
              <Field label="Adresse" value="23 rue de la Procession, B-7822 Ath" />
              <Field label="Email support" value="support@medikong.pro" />
              <Field label="Devise" value="EUR (€)" />
              <Field label="Pays principal" value="Belgique" />
              <Field label="Langues" value="FR, NL, EN" />
              <Field label="Fuseau horaire" value="Europe/Brussels (CET)" />
            </div>
          )}

          {section === "commissions" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Grille de commissions</h3>
              <Field label="Commission standard" value="12%" />
              <Field label="Commission probation (+3%)" value="15%" />
              <Field label="Commission Gold" value="10%" />
              <Field label="Commission Strategic" value="8%" />
              <Field label="Seuil Gold" value="€50 000 GMV/trimestre" />
              <Field label="Seuil Strategic" value="€150 000 GMV/trimestre" />
              <Field label="Frais listing" value="Gratuit" />
              <Field label="Frais CPA Lead" value="€2.50 / lead qualifié" />
            </div>
          )}

          {section === "emails" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Configuration emails</h3>
              <Field label="Expéditeur" value="noreply@medikong.pro" />
              <Field label="Reply-to" value="support@medikong.pro" />
              <Field label="Provider SMTP" value="Resend (API)" />
              <Field label="Templates" value="12 actifs" />
              <Field label="Emails envoyés (mars)" value="4 832" />
            </div>
          )}

          {section === "webhooks" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Webhooks configurés</h3>
              <Field label="Nouvelle commande" value="POST → ERP / Comptabilité" />
              <Field label="Statut commande" value="POST → Notification vendeur" />
              <Field label="Nouveau vendeur" value="POST → CRM + Slack" />
              <Field label="Alerte stock" value="POST → Slack #ops" />
            </div>
          )}

          {section === "apikeys" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Clés API</h3>
              <Field label="API publique (catalogue)" value="mk_pub_****7f3a" />
              <Field label="API privée (admin)" value="mk_priv_****9d2e" />
              <Field label="Webhook secret" value="whsec_****4b1c" />
              <Field label="Rate limit" value="1000 req/min (pub), 100 req/min (priv)" />
            </div>
          )}

          {section === "paiements" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Configuration paiements</h3>
              <Field label="Processor" value="Stripe Connect" />
              <Field label="Mode" value="Production" />
              <Field label="Méthodes acceptées" value="Carte, Bancontact, Virement SEPA" />
              <Field label="Délai reversement" value="J+7 (standard), J+3 (Gold)" />
              <Field label="Devise reversement" value="EUR" />
            </div>
          )}

          {section === "securite" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Sécurité</h3>
              <Field label="2FA obligatoire (admin)" value="Oui" />
              <Field label="Expiration session" value="24h" />
              <Field label="Politique mot de passe" value="Min 12 car., majuscule, chiffre, spécial" />
              <Field label="IP whitelist admin" value="Désactivé" />
              <Field label="Logs d'audit" value="Activé (90j rétention)" />
              <Field label="Chiffrement" value="AES-256 (données sensibles)" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminParametres;
