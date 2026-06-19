import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

/**
 * Catalogue (front) des templates email connus, exposés à l'admin pour
 * configuration. Les templates eux-mêmes restent du code (React Email) —
 * cette page permet seulement de surcharger l'objet et le corps HTML, et de
 * documenter l'événement déclencheur attendu.
 */
const KNOWN_TEMPLATES: Array<{
  name: string;
  displayName: string;
  description: string;
  defaultEvent: string;
  events: Array<{ value: string; label: string }>;
  variables: string[];
}> = [
  {
    name: "order-line-accepted",
    displayName: "Acheteur — Commande en préparation",
    description:
      "Envoyé à l'acheteur lorsque le vendeur accepte la commande (statut → préparation).",
    defaultEvent: "vendor_accept_order",
    events: [
      { value: "vendor_accept_order", label: "Vendeur — Accepte la commande" },
      { value: "vendor_mark_processing", label: "Vendeur — Marque en préparation" },
      { value: "manual_admin_send", label: "Envoi manuel admin" },
    ],
    variables: ["orderNumber", "vendorLabel", "orderUrl", "linesHtml", "totalIncl", "currency"],
  },
  {
    name: "order-line-shipped",
    displayName: "Acheteur — Commande expédiée",
    description:
      "Envoyé à l'acheteur lorsque le vendeur marque la commande comme expédiée.",
    defaultEvent: "vendor_mark_shipped",
    events: [
      { value: "vendor_mark_shipped", label: "Vendeur — Marque expédiée" },
      { value: "carrier_pickup", label: "Transporteur — Prise en charge" },
      { value: "manual_admin_send", label: "Envoi manuel admin" },
    ],
    variables: [
      "orderNumber",
      "vendorLabel",
      "trackingNumber",
      "trackingUrl",
      "carrierName",
      "orderUrl",
      "linesHtml",
      "totalIncl",
      "currency",
    ],
  },
  {
    name: "order-line-delivered",
    displayName: "Acheteur — Commande livrée",
    description:
      "Envoyé à l'acheteur lorsque le vendeur confirme la livraison de la commande.",
    defaultEvent: "vendor_mark_delivered",
    events: [
      { value: "vendor_mark_delivered", label: "Vendeur — Marque livrée" },
      { value: "carrier_proof_of_delivery", label: "Transporteur — Preuve de livraison" },
      { value: "manual_admin_send", label: "Envoi manuel admin" },
    ],
    variables: ["orderNumber", "vendorLabel", "orderUrl", "linesHtml", "totalIncl", "currency"],
  },
];

type Override = {
  template_name: string;
  trigger_event: string | null;
  custom_subject: string | null;
  custom_body_html: string | null;
  enabled: boolean;
  updated_at?: string;
};

const SAMPLE_DATA: Record<string, any> = {
  orderNumber: "MK-2026-000123",
  vendorLabel: "Fournisseur ABC123",
  orderUrl: "https://medikong.pro/commande/xxx",
  trackingNumber: "3SBPM1234567890",
  trackingUrl: "https://tracking.bpost.be/btr/web/#/search?itemCode=3SBPM1234567890",
  carrierName: "bpost",
  totalIncl: 46,
  currency: "EUR",
  lines: [
    { name: "Doliprane 1000 mg, boîte de 8", quantity: 12, lineTotalTtc: 30 },
    { name: "Efferalgan 500 mg, boîte de 16", quantity: 5, lineTotalTtc: 16 },
  ],
};

function interpolate(tpl: string, data: Record<string, any>) {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const lines: any[] = Array.isArray(data.lines) ? data.lines : [];
  const linesHtml = lines.length
    ? `<ul style="padding-left:18px;margin:8px 0">${lines
        .map(
          (l) =>
            `<li>${esc(String(l.quantity ?? ""))}× ${esc(String(l.name ?? ""))}${
              typeof l.lineTotalTtc === "number" ? ` — ${l.lineTotalTtc.toFixed(2)} ${esc(String(data.currency ?? "EUR"))}` : ""
            }</li>`
        )
        .join("")}</ul>`
    : "";
  return tpl
    .replace(/\{\{\s*linesHtml\s*\}\}/g, linesHtml)
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
      const v = data[k];
      if (v === undefined || v === null) return "";
      if (typeof v === "object") return "";
      return esc(String(v));
    });
}

const DEFAULT_BODY = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1D2530">
  <h2 style="color:#1e3a5f">Votre commande {{orderNumber}}</h2>
  <p>Bonjour,</p>
  <p>{{vendorLabel}} a mis à jour le statut de votre commande <strong>{{orderNumber}}</strong>.</p>
  <h3 style="color:#1B5BDA;font-size:14px;margin:18px 0 8px">Détail de votre commande</h3>
  {{linesHtml}}
  <p><strong>Total TTC : {{totalIncl}} {{currency}}</strong></p>
  <p><a href="{{orderUrl}}" style="color:#1B5BDA">Suivre ma commande →</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
  <p style="font-size:12px;color:#9ca3af">L'équipe MediKong</p>
</div>`;

export default function AdminEmailTemplates() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(KNOWN_TEMPLATES[0].name);
  const tpl = useMemo(() => KNOWN_TEMPLATES.find((t) => t.name === selected)!, [selected]);

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["admin-email-template-overrides"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_template_overrides")
        .select("*");
      if (error) throw error;
      return (data ?? []) as Override[];
    },
  });

  const current = overrides?.find((o) => o.template_name === selected);

  const [enabled, setEnabled] = useState(false);
  const [triggerEvent, setTriggerEvent] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");

  useEffect(() => {
    setEnabled(current?.enabled ?? false);
    setTriggerEvent(current?.trigger_event ?? tpl.defaultEvent);
    setSubject(current?.custom_subject ?? "");
    setBody(current?.custom_body_html ?? "");
  }, [selected, current, tpl.defaultEvent]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        template_name: selected,
        trigger_event: triggerEvent || null,
        custom_subject: subject || null,
        custom_body_html: body || null,
        enabled,
      };
      const { error } = await (supabase as any)
        .from("email_template_overrides")
        .upsert(payload, { onConflict: "template_name" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template enregistré");
      qc.invalidateQueries({ queryKey: ["admin-email-template-overrides"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'enregistrement"),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("email_template_overrides")
        .delete()
        .eq("template_name", selected);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Surcharge supprimée — retour au template par défaut");
      qc.invalidateQueries({ queryKey: ["admin-email-template-overrides"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const previewHtml = useMemo(() => {
    const src = body && body.trim().length > 0 ? body : DEFAULT_BODY;
    return interpolate(src, SAMPLE_DATA);
  }, [body]);

  const previewSubject = useMemo(() => {
    const src = subject && subject.trim().length > 0 ? subject : "(objet par défaut du template code)";
    return interpolate(src, SAMPLE_DATA);
  }, [subject]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-mk-sec" />
        <h1 className="text-xl font-semibold">Email templates</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Gestion des emails transactionnels MediKong. Chaque template a un événement déclencheur
        (côté code) et peut être surchargé ici (objet + corps HTML) sans toucher au code.
        Variables disponibles : <code>{"{{nomVariable}}"}</code>. Pour la liste d'articles,
        utiliser <code>{"{{linesHtml}}"}</code>.
      </p>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 md:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm">Templates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {KNOWN_TEMPLATES.map((t) => {
                const ov = overrides?.find((o) => o.template_name === t.name);
                return (
                  <li key={t.name}>
                    <button
                      onClick={() => setSelected(t.name)}
                      className={`w-full text-left px-3 py-2.5 text-[13px] hover:bg-muted/50 ${
                        selected === t.name ? "bg-muted/60" : ""
                      }`}
                    >
                      <div className="font-medium">{t.displayName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {t.name}
                      </div>
                      {ov?.enabled && (
                        <div className="text-[10px] text-emerald-600 mt-0.5">
                          ● Surcharge active
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="col-span-12 md:col-span-8">
          <CardHeader>
            <CardTitle className="text-sm">{tpl.displayName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Chargement…
              </div>
            ) : (
              <>
                <p className="text-[12px] text-muted-foreground">{tpl.description}</p>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-[13px]">Activer la surcharge</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Si désactivé, le template par défaut (code) est utilisé.
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                <div>
                  <Label className="text-[12px]">Événement déclencheur</Label>
                  <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                    <SelectTrigger><SelectValue placeholder="Choisir un événement" /></SelectTrigger>
                    <SelectContent>
                      {tpl.events.map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Note : le déclencheur réel est défini côté code (les emails partent automatiquement
                    quand le vendeur change le statut). Ce champ documente / verrouille l'événement attendu.
                  </p>
                </div>

                <div>
                  <Label className="text-[12px]">Objet (subject)</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Votre commande MediKong {{orderNumber}} est en cours de préparation"
                  />
                </div>

                <div>
                  <Label className="text-[12px]">Corps HTML</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="font-mono text-[12px]"
                    placeholder={DEFAULT_BODY}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Variables : {tpl.variables.map((v) => `{{${v}}}`).join(" · ")}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                    Enregistrer
                  </Button>
                  <Button variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>
                    <RotateCcw className="size-4 mr-1" />
                    Réinitialiser (retour au défaut)
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-[12px]">Aperçu (avec données de démo)</Label>
                  <div className="mt-1 rounded-md border bg-white">
                    <div className="px-3 py-2 border-b bg-muted/40 text-[12px]">
                      <strong>Objet :</strong> {previewSubject}
                    </div>
                    <iframe
                      title="Aperçu email"
                      className="w-full h-[420px]"
                      sandbox=""
                      srcDoc={previewHtml}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
