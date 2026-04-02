import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users, Mail, Eye, MousePointerClick, Send, Clock, Plus, Trash2, MailOpen,
} from "lucide-react";

const AdminCRM = () => {
  const [tab, setTab] = useState("segments");
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: "", segment: "", status: "draft" });
  const [messageForm, setMessageForm] = useState({ sender_name: "", sender_email: "", subject: "", body: "" });
  const queryClient = useQueryClient();

  // Fetch contacts count from customers table
  const { data: contactsCount = 0 } = useQuery({
    queryKey: ["crm-contacts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("customers").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ["crm-campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_campaigns").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ["crm-messages"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_messages").select("*").order("received_at", { ascending: false });
      return data ?? [];
    },
  });

  // KPI computed values
  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
  const totalOpened = campaigns.reduce((s, c) => s + (c.opened_count || 0), 0);
  const totalClicked = campaigns.reduce((s, c) => s + (c.clicked_count || 0), 0);
  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
  const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0";
  const unreadCount = messages.filter((m) => !m.is_read).length;

  // Segments from customers
  const { data: segments = [] } = useQuery({
    queryKey: ["crm-segments"],
    queryFn: async () => {
      const { data: customers } = await supabase.from("customers").select("customer_type, is_verified, country_code");
      if (!customers) return [];
      const types: Record<string, { count: number; color: string; bg: string }> = {};
      const colorMap: Record<string, { color: string; bg: string }> = {
        pharmacy: { color: "#1B5BDA", bg: "#EFF6FF" },
        hospital: { color: "#059669", bg: "#ECFDF5" },
        wholesaler: { color: "#7C3AED", bg: "#F3F0FF" },
        distributor: { color: "#F59E0B", bg: "#FFFBEB" },
        other: { color: "#EF4343", bg: "#FEF2F2" },
      };
      customers.forEach((c) => {
        const t = c.customer_type || "other";
        if (!types[t]) types[t] = { count: 0, ...(colorMap[t] || colorMap.other) };
        types[t].count++;
      });
      return Object.entries(types).map(([name, v]) => ({ name, ...v }));
    },
  });

  // Add campaign
  const addCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_campaigns").insert({ name: campaignForm.name, segment: campaignForm.segment || null, status: campaignForm.status });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm-campaigns"] }); setShowCampaignDialog(false); setCampaignForm({ name: "", segment: "", status: "draft" }); toast.success("Campagne créée"); },
    onError: () => toast.error("Erreur création campagne"),
  });

  // Delete campaign
  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => { await supabase.from("crm_campaigns").delete().eq("id", id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm-campaigns"] }); toast.success("Campagne supprimée"); },
  });

  // Add message
  const addMessage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_messages").insert(messageForm);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm-messages"] }); setShowMessageDialog(false); setMessageForm({ sender_name: "", sender_email: "", subject: "", body: "" }); toast.success("Message ajouté"); },
    onError: () => toast.error("Erreur ajout message"),
  });

  // Toggle read
  const toggleRead = useMutation({
    mutationFn: async ({ id, is_read }: { id: string; is_read: boolean }) => { await supabase.from("crm_messages").update({ is_read: !is_read }).eq("id", id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-messages"] }),
  });

  // Delete message
  const deleteMessage = useMutation({
    mutationFn: async (id: string) => { await supabase.from("crm_messages").delete().eq("id", id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm-messages"] }); toast.success("Message supprimé"); },
  });

  return (
    <div>
      <AdminTopBar title="CRM" subtitle="Gestion de la relation client & campagnes" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Users} label="Contacts" value={String(contactsCount)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Mail} label="Emails envoyés" value={String(totalSent)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Eye} label="Taux ouverture" value={`${openRate}%`} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={MousePointerClick} label="Taux clic" value={`${clickRate}%`} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="segments" className="text-[13px]">Segments</TabsTrigger>
          <TabsTrigger value="campagnes" className="text-[13px]">Campagnes</TabsTrigger>
          <TabsTrigger value="messages" className="text-[13px]">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="segments">
          {segments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Aucun segment — les segments sont calculés automatiquement à partir de vos contacts clients.</div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {segments.map((s) => (
                <div key={s.name} className="bg-white rounded-lg border p-5 flex items-center gap-4" style={{ borderColor: "#E2E8F0" }}>
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg }}>
                    <Users size={20} style={{ color: s.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold capitalize" style={{ color: "#1D2530" }}>{s.name}</p>
                    <p className="text-[22px] font-bold" style={{ color: s.color }}>{s.count}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="campagnes">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowCampaignDialog(true)}><Plus size={14} className="mr-1" /> Nouvelle campagne</Button>
          </div>
          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Aucune campagne créée pour le moment.</div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="bg-white rounded-lg border p-4 flex items-center gap-4" style={{ borderColor: "#E2E8F0" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.status === "sent" ? "#ECFDF5" : "#FFFBEB" }}>
                    {c.status === "sent" ? <Send size={16} style={{ color: "#059669" }} /> : <Clock size={16} style={{ color: "#F59E0B" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: "#8B95A5" }}>{c.sent_at ? format(new Date(c.sent_at), "dd/MM/yyyy", { locale: fr }) : "Brouillon"}</p>
                  </div>
                  {c.status === "sent" && (
                    <div className="flex gap-4 text-[11px]" style={{ color: "#616B7C" }}>
                      <span>Envoyés: <b>{c.sent_count}</b></span>
                      <span>Ouverts: <b>{c.opened_count}</b></span>
                      <span>Clics: <b>{c.clicked_count}</b></span>
                    </div>
                  )}
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: c.status === "sent" ? "#059669" : "#F59E0B",
                    borderColor: c.status === "sent" ? "#BBF7D0" : "#FDE68A",
                    backgroundColor: c.status === "sent" ? "#ECFDF5" : "#FFFBEB",
                  }}>
                    {c.status === "sent" ? "Envoyé" : "Brouillon"}
                  </Badge>
                  <button onClick={() => deleteCampaign.mutate(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="messages">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowMessageDialog(true)}><Plus size={14} className="mr-1" /> Nouveau message</Button>
          </div>
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Aucun message reçu.</div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
              {messages.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0" style={{ borderColor: "#F1F5F9", backgroundColor: !m.is_read ? "#FAFBFF" : "transparent" }}>
                  {!m.is_read && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#1B5BDA" }} />}
                  {m.is_read && <div className="w-2 h-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className={`text-[12px] ${!m.is_read ? "font-bold" : "font-medium"}`} style={{ color: "#1D2530" }}>{m.sender_name}</span>
                    <p className="text-[12px] truncate" style={{ color: "#616B7C" }}>{m.subject}</p>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: "#8B95A5" }}>{format(new Date(m.received_at), "dd/MM HH:mm")}</span>
                  <button onClick={() => toggleRead.mutate({ id: m.id, is_read: m.is_read })} className="text-muted-foreground hover:text-primary" title={m.is_read ? "Marquer non lu" : "Marquer lu"}>
                    <MailOpen size={14} />
                  </button>
                  <button onClick={() => deleteMessage.mutate(m.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog nouvelle campagne */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle campagne</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom de la campagne" value={campaignForm.name} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Segment cible (optionnel)" value={campaignForm.segment} onChange={(e) => setCampaignForm((p) => ({ ...p, segment: e.target.value }))} />
            <Select value={campaignForm.status} onValueChange={(v) => setCampaignForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>Annuler</Button>
            <Button onClick={() => addCampaign.mutate()} disabled={!campaignForm.name}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nouveau message */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom expéditeur" value={messageForm.sender_name} onChange={(e) => setMessageForm((p) => ({ ...p, sender_name: e.target.value }))} />
            <Input placeholder="Email expéditeur" value={messageForm.sender_email} onChange={(e) => setMessageForm((p) => ({ ...p, sender_email: e.target.value }))} />
            <Input placeholder="Sujet" value={messageForm.subject} onChange={(e) => setMessageForm((p) => ({ ...p, subject: e.target.value }))} />
            <Textarea placeholder="Contenu du message" value={messageForm.body} onChange={(e) => setMessageForm((p) => ({ ...p, body: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>Annuler</Button>
            <Button onClick={() => addMessage.mutate()} disabled={!messageForm.sender_name || !messageForm.subject}>Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCRM;
