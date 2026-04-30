import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Mail, Clock } from "lucide-react";

interface ReminderTemplate {
  id: string;
  wave_number: number;
  delay_hours: number;
  subject_fr: string;
  body_fr: string;
  is_active: boolean;
  updated_at: string;
}

const VARIABLES = [
  { key: "vendor_name", label: "Nom du vendeur" },
  { key: "product_name", label: "Nom du produit" },
  { key: "quantity", label: "Quantité demandée" },
  { key: "deadline_in_hours", label: "Heures restantes avant clôture" },
  { key: "respond_url", label: "Lien pour répondre au RFQ" },
];

export default function AdminRfqRemindersPage() {
  const qc = useQueryClient();
  const [draftById, setDraftById] = useState<Record<string, Partial<ReminderTemplate>>>({});

  const { data: templates, isLoading } = useQuery({
    queryKey: ["rfq-reminder-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_reminder_templates")
        .select("*")
        .order("wave_number");
      if (error) throw error;
      return data as ReminderTemplate[];
    },
  });

  const updateMut = useMutation({
    mutationFn: async (input: Partial<ReminderTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("rfq_reminder_templates")
        .update({
          subject_fr: input.subject_fr,
          body_fr: input.body_fr,
          delay_hours: input.delay_hours,
          is_active: input.is_active,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Template mis à jour");
      setDraftById((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["rfq-reminder-templates"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur de sauvegarde"),
  });

  const triggerNowMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-rfq-reminders");
      if (error) throw error;
      return data as { total: number; sent: number; skipped: number; errors: number };
    },
    onSuccess: (r) =>
      toast.success(`Cible: ${r.total} · Envoyées: ${r.sent} · Sautées: ${r.skipped} · Erreurs: ${r.errors}`),
    onError: (e: any) => toast.error(e?.message || "Échec du déclenchement"),
  });

  const getValue = <K extends keyof ReminderTemplate>(t: ReminderTemplate, k: K): ReminderTemplate[K] => {
    const draft = draftById[t.id]?.[k];
    return (draft !== undefined ? draft : t[k]) as ReminderTemplate[K];
  };

  const setDraft = (id: string, patch: Partial<ReminderTemplate>) => {
    setDraftById((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  return (
    <div className="container py-8 space-y-6">
      <Helmet>
        <title>Relances RFQ — Admin MediKong</title>
      </Helmet>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Relances RFQ automatiques</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Templates envoyés automatiquement aux vendeurs qui ont vu un RFQ sans répondre.
            Cron toutes les 30 minutes. Cibles : statuts <code>viewed</code>, <code>pending_review</code>.
            Décliés et répondants exclus automatiquement.
          </p>
        </div>
        <Button
          onClick={() => triggerNowMut.mutate()}
          disabled={triggerNowMut.isPending}
          variant="outline"
        >
          {triggerNowMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
          Déclencher maintenant
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Variables disponibles</CardTitle>
          <CardDescription>
            Insérez ces variables dans le sujet ou le corps avec la syntaxe <code>{"{{variable}}"}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <Badge key={v.key} variant="secondary" className="font-mono text-xs">
                {`{{${v.key}}}`} — {v.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {templates?.map((t) => {
        const isDirty = !!draftById[t.id];
        return (
          <Card key={t.id}>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Badge>Vague {t.wave_number}</Badge>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-normal text-muted-foreground text-sm">
                      Envoyée {getValue(t, "delay_hours")}h après le dispatch initial
                    </span>
                  </CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={getValue(t, "is_active")}
                      onCheckedChange={(v) => setDraft(t.id, { is_active: v })}
                    />
                    <Label className="text-sm">Actif</Label>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => updateMut.mutate({ id: t.id, ...draftById[t.id] })}
                    disabled={!isDirty || updateMut.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`delay-${t.id}`}>Délai (heures après dispatch)</Label>
                  <Input
                    id={`delay-${t.id}`}
                    type="number"
                    min={1}
                    max={720}
                    value={getValue(t, "delay_hours")}
                    onChange={(e) => setDraft(t.id, { delay_hours: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor={`subject-${t.id}`}>Sujet de l'email</Label>
                  <Input
                    id={`subject-${t.id}`}
                    value={getValue(t, "subject_fr")}
                    onChange={(e) => setDraft(t.id, { subject_fr: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor={`body-${t.id}`}>Corps du message</Label>
                <Textarea
                  id={`body-${t.id}`}
                  rows={10}
                  value={getValue(t, "body_fr")}
                  onChange={(e) => setDraft(t.id, { body_fr: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
              {isDirty && (
                <p className="text-xs text-amber-600">Modifications non enregistrées</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
