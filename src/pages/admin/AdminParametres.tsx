import { useState, useEffect } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import {
  Settings, Building2, Percent, Mail, Webhook, Key, CreditCard, ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Pencil } from "lucide-react";

const sidebarItems = [
  { key: "general", label: "Général", icon: Building2 },
  { key: "commissions", label: "Commissions", icon: Percent },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "apikeys", label: "API Keys", icon: Key },
  { key: "paiements", label: "Paiements", icon: CreditCard },
  { key: "securite", label: "Sécurité", icon: ShieldCheck },
];

const EditableField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between py-3 border-b gap-4" style={{ borderColor: "#F1F5F9" }}>
    <span className="text-[12px] font-medium shrink-0" style={{ color: "#616B7C" }}>{label}</span>
    <Input value={value} onChange={e => onChange(e.target.value)} className="max-w-[300px] h-8 text-[13px] font-semibold text-right" />
  </div>
);

const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "#F1F5F9" }}>
    <span className="text-[12px] font-medium" style={{ color: "#616B7C" }}>{label}</span>
    <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{value}</span>
  </div>
);

const AdminParametres = () => {
  const [section, setSection] = useState("general");
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Load config from qogita_config (key-value store)
  const { data: configRows = [] } = useQuery({
    queryKey: ["admin-params-config"],
    queryFn: async () => {
      const { data } = await supabase.from("qogita_config").select("*");
      return data || [];
    },
  });

  const getConfig = (key: string, fallback: string) => configRows.find((r: any) => r.key === key)?.value || fallback;

  // Editable state
  const [general, setGeneral] = useState<Record<string, string>>({});
  const [commissions, setCommissions] = useState<Record<string, string>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [paiements, setPaiements] = useState<Record<string, string>>({});
  const [securite, setSecurite] = useState<Record<string, string>>({});

  useEffect(() => {
    if (configRows.length === 0) return;
    setGeneral({
      platform_name: getConfig("platform_name", "MediKong.pro"),
      legal_entity: getConfig("legal_entity", "Balooh SRL"),
      vat_number: getConfig("vat_number", "BE 1005.771.323"),
      address: getConfig("address", "23 rue de la Procession, B-7822 Ath"),
      support_email: getConfig("support_email", "support@medikong.pro"),
      currency: getConfig("currency", "EUR (€)"),
      main_country: getConfig("main_country", "Belgique"),
      languages: getConfig("languages", "FR, NL, EN"),
      timezone: getConfig("timezone", "Europe/Brussels (CET)"),
    });
    setCommissions({
      commission_standard: getConfig("commission_standard", "12%"),
      commission_probation: getConfig("commission_probation", "15%"),
      commission_gold: getConfig("commission_gold", "10%"),
      commission_strategic: getConfig("commission_strategic", "8%"),
      seuil_gold: getConfig("seuil_gold", "€50 000 GMV/trimestre"),
      seuil_strategic: getConfig("seuil_strategic", "€150 000 GMV/trimestre"),
      frais_listing: getConfig("frais_listing", "Gratuit"),
      frais_cpa_lead: getConfig("frais_cpa_lead", "€2.50 / lead qualifié"),
    });
    setEmails({
      sender: getConfig("email_sender", "noreply@medikong.pro"),
      reply_to: getConfig("email_reply_to", "support@medikong.pro"),
      smtp_provider: getConfig("smtp_provider", "Resend (API)"),
    });
    setPaiements({
      processor: getConfig("payment_processor", "Stripe Connect"),
      mode: getConfig("payment_mode", "Production"),
      methods: getConfig("payment_methods", "Carte, Bancontact, Virement SEPA"),
      reversal_delay: getConfig("reversal_delay", "J+7 (standard), J+3 (Gold)"),
      reversal_currency: getConfig("reversal_currency", "EUR"),
    });
    setSecurite({
      twofa: getConfig("admin_2fa", "Oui"),
      session_expiry: getConfig("session_expiry", "24h"),
      password_policy: getConfig("password_policy", "Min 12 car., majuscule, chiffre, spécial"),
      ip_whitelist: getConfig("ip_whitelist", "Désactivé"),
      audit_logs: getConfig("audit_logs", "Activé (90j rétention)"),
      encryption: getConfig("encryption", "AES-256 (données sensibles)"),
    });
  }, [configRows]);

  const saveSection = async (entries: Record<string, string>) => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(entries)) {
        await supabase.from("qogita_config").upsert({ key, value }, { onConflict: "key" });
      }
      toast.success("Paramètres sauvegardés");
      qc.invalidateQueries({ queryKey: ["admin-params-config"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const SectionSaveBtn = ({ data }: { data: Record<string, string> }) => (
    <Button onClick={() => saveSection(data)} disabled={saving} size="sm" className="mt-4">
      <Save size={14} className="mr-1" />{saving ? "..." : "Sauvegarder"}
    </Button>
  );

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
              <EditableField label="Nom de la plateforme" value={general.platform_name || ""} onChange={v => setGeneral(p => ({ ...p, platform_name: v }))} />
              <EditableField label="Entité juridique" value={general.legal_entity || ""} onChange={v => setGeneral(p => ({ ...p, legal_entity: v }))} />
              <EditableField label="N° TVA" value={general.vat_number || ""} onChange={v => setGeneral(p => ({ ...p, vat_number: v }))} />
              <EditableField label="Adresse" value={general.address || ""} onChange={v => setGeneral(p => ({ ...p, address: v }))} />
              <EditableField label="Email support" value={general.support_email || ""} onChange={v => setGeneral(p => ({ ...p, support_email: v }))} />
              <EditableField label="Devise" value={general.currency || ""} onChange={v => setGeneral(p => ({ ...p, currency: v }))} />
              <EditableField label="Pays principal" value={general.main_country || ""} onChange={v => setGeneral(p => ({ ...p, main_country: v }))} />
              <EditableField label="Langues" value={general.languages || ""} onChange={v => setGeneral(p => ({ ...p, languages: v }))} />
              <EditableField label="Fuseau horaire" value={general.timezone || ""} onChange={v => setGeneral(p => ({ ...p, timezone: v }))} />
              <SectionSaveBtn data={general} />
            </div>
          )}

          {section === "commissions" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Grille de commissions</h3>
              <EditableField label="Commission standard" value={commissions.commission_standard || ""} onChange={v => setCommissions(p => ({ ...p, commission_standard: v }))} />
              <EditableField label="Commission probation (+3%)" value={commissions.commission_probation || ""} onChange={v => setCommissions(p => ({ ...p, commission_probation: v }))} />
              <EditableField label="Commission Gold" value={commissions.commission_gold || ""} onChange={v => setCommissions(p => ({ ...p, commission_gold: v }))} />
              <EditableField label="Commission Strategic" value={commissions.commission_strategic || ""} onChange={v => setCommissions(p => ({ ...p, commission_strategic: v }))} />
              <EditableField label="Seuil Gold" value={commissions.seuil_gold || ""} onChange={v => setCommissions(p => ({ ...p, seuil_gold: v }))} />
              <EditableField label="Seuil Strategic" value={commissions.seuil_strategic || ""} onChange={v => setCommissions(p => ({ ...p, seuil_strategic: v }))} />
              <EditableField label="Frais listing" value={commissions.frais_listing || ""} onChange={v => setCommissions(p => ({ ...p, frais_listing: v }))} />
              <EditableField label="Frais CPA Lead" value={commissions.frais_cpa_lead || ""} onChange={v => setCommissions(p => ({ ...p, frais_cpa_lead: v }))} />
              <SectionSaveBtn data={commissions} />
            </div>
          )}

          {section === "emails" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Configuration emails</h3>
              <EditableField label="Expéditeur" value={emails.sender || ""} onChange={v => setEmails(p => ({ ...p, sender: v }))} />
              <EditableField label="Reply-to" value={emails.reply_to || ""} onChange={v => setEmails(p => ({ ...p, reply_to: v }))} />
              <EditableField label="Provider SMTP" value={emails.smtp_provider || ""} onChange={v => setEmails(p => ({ ...p, smtp_provider: v }))} />
              <SectionSaveBtn data={emails} />
            </div>
          )}

          {section === "webhooks" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Webhooks configurés</h3>
              <ReadOnlyField label="Nouvelle commande" value="POST → ERP / Comptabilité" />
              <ReadOnlyField label="Statut commande" value="POST → Notification vendeur" />
              <ReadOnlyField label="Nouveau vendeur" value="POST → CRM + Slack" />
              <ReadOnlyField label="Alerte stock" value="POST → Slack #ops" />
            </div>
          )}

          {section === "apikeys" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Clés API</h3>
              <ReadOnlyField label="API publique (catalogue)" value="mk_pub_****7f3a" />
              <ReadOnlyField label="API privée (admin)" value="mk_priv_****9d2e" />
              <ReadOnlyField label="Webhook secret" value="whsec_****4b1c" />
              <ReadOnlyField label="Rate limit" value="1000 req/min (pub), 100 req/min (priv)" />
            </div>
          )}

          {section === "paiements" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Configuration paiements</h3>
              <EditableField label="Processor" value={paiements.processor || ""} onChange={v => setPaiements(p => ({ ...p, processor: v }))} />
              <EditableField label="Mode" value={paiements.mode || ""} onChange={v => setPaiements(p => ({ ...p, mode: v }))} />
              <EditableField label="Méthodes acceptées" value={paiements.methods || ""} onChange={v => setPaiements(p => ({ ...p, methods: v }))} />
              <EditableField label="Délai reversement" value={paiements.reversal_delay || ""} onChange={v => setPaiements(p => ({ ...p, reversal_delay: v }))} />
              <EditableField label="Devise reversement" value={paiements.reversal_currency || ""} onChange={v => setPaiements(p => ({ ...p, reversal_currency: v }))} />
              <SectionSaveBtn data={paiements} />
            </div>
          )}

          {section === "securite" && (
            <div>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: "#1D2530" }}>Sécurité</h3>
              <EditableField label="2FA obligatoire (admin)" value={securite.twofa || ""} onChange={v => setSecurite(p => ({ ...p, twofa: v }))} />
              <EditableField label="Expiration session" value={securite.session_expiry || ""} onChange={v => setSecurite(p => ({ ...p, session_expiry: v }))} />
              <EditableField label="Politique mot de passe" value={securite.password_policy || ""} onChange={v => setSecurite(p => ({ ...p, password_policy: v }))} />
              <EditableField label="IP whitelist admin" value={securite.ip_whitelist || ""} onChange={v => setSecurite(p => ({ ...p, ip_whitelist: v }))} />
              <EditableField label="Logs d'audit" value={securite.audit_logs || ""} onChange={v => setSecurite(p => ({ ...p, audit_logs: v }))} />
              <EditableField label="Chiffrement" value={securite.encryption || ""} onChange={v => setSecurite(p => ({ ...p, encryption: v }))} />
              <SectionSaveBtn data={securite} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminParametres;
