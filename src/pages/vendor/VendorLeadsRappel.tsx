import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { PhoneCall, Mail, MapPin, Calendar, MessageSquare, User, Building2, Clock, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type Status = "pending" | "in_progress" | "done" | "cancelled";

interface CallbackRequest {
  id: string;
  delegate_id: string;
  vendor_id: string;
  requester_first_name: string;
  requester_last_name: string;
  requester_company: string | null;
  requester_email: string;
  requester_phone: string;
  buyer_profile: string | null;
  country_code: string | null;
  postal_code: string | null;
  preferred_slot: string | null;
  message: string | null;
  status: Status;
  vendor_notes: string | null;
  handled_at: string | null;
  created_at: string;
  delegate?: { first_name: string; last_name: string } | null;
}

const STATUS_META: Record<Status, { label: string; variant: any; icon: any; color: string }> = {
  pending: { label: "À traiter", variant: "destructive", icon: Clock, color: "text-red-600" },
  in_progress: { label: "En cours", variant: "default", icon: PlayCircle, color: "text-blue-600" },
  done: { label: "Traité", variant: "secondary", icon: CheckCircle2, color: "text-emerald-600" },
  cancelled: { label: "Annulé", variant: "outline", icon: XCircle, color: "text-muted-foreground" },
};

export default function VendorLeadsRappel() {
  const { data: vendor } = useCurrentVendor();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status | "all">("pending");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery<CallbackRequest[]>({
    queryKey: ["vendor-callback-requests", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data, error } = await supabase
        .from("delegate_callback_requests" as any)
        .select("*, delegate:vendor_delegates(first_name, last_name)")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CallbackRequest[];
    },
    enabled: !!vendor?.id,
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CallbackRequest> }) => {
      const payload: any = { ...patch };
      if (patch.status === "done" || patch.status === "cancelled") {
        payload.handled_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("delegate_callback_requests" as any)
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-callback-requests", vendor?.id] });
      toast({ title: "Mis à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    in_progress: rows.filter((r) => r.status === "in_progress").length,
    done: rows.filter((r) => r.status === "done").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    all: rows.length,
  };

  const filtered = tab === "all" ? rows : rows.filter((r) => r.status === tab);

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <PhoneCall className="text-primary" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Leads "Rappelez-moi"</h1>
          <p className="text-sm text-muted-foreground">
            Demandes de rappel transmises par les acheteurs vérifiés depuis les fiches de vos délégués.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">À traiter ({counts.pending})</TabsTrigger>
          <TabsTrigger value="in_progress">En cours ({counts.in_progress})</TabsTrigger>
          <TabsTrigger value="done">Traités ({counts.done})</TabsTrigger>
          <TabsTrigger value="cancelled">Annulés ({counts.cancelled})</TabsTrigger>
          <TabsTrigger value="all">Tous ({counts.all})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && filtered.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Aucune demande dans cette catégorie.
            </Card>
          )}
          {filtered.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold flex items-center gap-1.5">
                        <User size={16} className="text-muted-foreground" />
                        {r.requester_first_name} {r.requester_last_name}
                      </h3>
                      <Badge variant={meta.variant} className="gap-1">
                        <Icon size={11} /> {meta.label}
                      </Badge>
                      {r.buyer_profile && (
                        <Badge variant="outline" className="text-[10px]">{r.buyer_profile}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reçu {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: fr })}
                      {r.delegate && (
                        <> · Délégué : <strong>{r.delegate.first_name} {r.delegate.last_name}</strong></>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateMut.mutate({ id: r.id, patch: { status: "in_progress" } })}>
                        Prendre en charge
                      </Button>
                    )}
                    {(r.status === "pending" || r.status === "in_progress") && (
                      <>
                        <Button size="sm" onClick={() => updateMut.mutate({ id: r.id, patch: { status: "done", vendor_notes: notesDraft[r.id] ?? r.vendor_notes } })}>
                          Marquer traité
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: r.id, patch: { status: "cancelled" } })}>
                          Annuler
                        </Button>
                      </>
                    )}
                    {(r.status === "done" || r.status === "cancelled") && (
                      <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: r.id, patch: { status: "pending", handled_at: null as any } })}>
                        Rouvrir
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {r.requester_company && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 size={13} /> {r.requester_company}
                    </div>
                  )}
                  <a href={`tel:${r.requester_phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
                    <PhoneCall size={13} /> {r.requester_phone}
                  </a>
                  <a href={`mailto:${r.requester_email}`} className="flex items-center gap-1.5 text-foreground hover:text-primary truncate">
                    <Mail size={13} /> {r.requester_email}
                  </a>
                  {(r.postal_code || r.country_code) && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin size={13} /> {[r.postal_code, r.country_code].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {r.preferred_slot && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar size={13} /> Créneau : {r.preferred_slot}
                    </div>
                  )}
                </div>

                {r.message && (
                  <div className="bg-muted/50 rounded-md p-3 text-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <MessageSquare size={11} /> Message
                    </p>
                    {r.message}
                  </div>
                )}

                {(r.status === "in_progress" || r.status === "pending") && (
                  <div>
                    <Textarea
                      rows={2}
                      placeholder="Notes internes (optionnel)…"
                      defaultValue={r.vendor_notes || ""}
                      onChange={(e) => setNotesDraft((s) => ({ ...s, [r.id]: e.target.value }))}
                      onBlur={(e) => {
                        if ((e.target.value || "") !== (r.vendor_notes || "")) {
                          updateMut.mutate({ id: r.id, patch: { vendor_notes: e.target.value } });
                        }
                      }}
                      className="text-sm"
                    />
                  </div>
                )}
                {r.vendor_notes && (r.status === "done" || r.status === "cancelled") && (
                  <p className="text-xs text-muted-foreground italic">Notes : {r.vendor_notes}</p>
                )}
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
