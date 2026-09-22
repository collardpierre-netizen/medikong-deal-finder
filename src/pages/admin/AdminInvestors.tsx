import { useMemo, useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { fmtEurFromCents } from "@/lib/format-currency";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";

type InvestorStatus = "pending" | "contacted" | "signed" | "paid" | "confirmed" | "refunded" | "cancelled";

interface Investor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  amount_cents: number;
  status: InvestorStatus;
  notes: string | null;
  created_at: string;
}

const STATUS: Record<InvestorStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "En attente", bg: "#FEF3C7", text: "#D97706" },
  contacted: { label: "Contacté", bg: "#DBEAFE", text: "#2563EB" },
  signed: { label: "Signé", bg: "#D1FAE5", text: "#059669" },
  paid: { label: "Payé", bg: "#ECFDF5", text: "#047857" },
  confirmed: { label: "Confirmé", bg: "#DCFCE7", text: "#15803D" },
  refunded: { label: "Remboursé", bg: "#F1F5F9", text: "#475569" },
  cancelled: { label: "Annulé", bg: "#FEE2E2", text: "#DC2626" },
};


const STATUS_KEYS = Object.keys(STATUS) as InvestorStatus[];

interface FormState {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  amount: string;
  status: InvestorStatus;
  notes: string;
}

const emptyForm: FormState = {
  first_name: "", last_name: "", email: "", phone: "", amount: "", status: "pending", notes: "",
};

export default function AdminInvestors() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvestorStatus>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: investors = [], isLoading } = useQuery({
    queryKey: ["admin-investors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investors")
        .select("id, first_name, last_name, email, phone, amount_cents, status, notes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Investor[];
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const amountCents = Math.round((parseFloat(f.amount.replace(",", ".")) || 0) * 100);
      const payload = {
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim() || null,
        amount_cents: amountCents,
        status: f.status,
        notes: f.notes.trim() || null,
      };
      if (f.id) {
        const { error } = await supabase.from("investors").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("investors").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-investors"] });
      setOpen(false);
      setForm(emptyForm);
      toast({ title: "Investisseur enregistré" });
    },
    onError: (e: any) => toast({ title: "Échec de l'enregistrement", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-investors"] });
      toast({ title: "Investisseur supprimé" });
    },
    onError: (e: any) => toast({ title: "Suppression impossible", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return investors.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (!q) return true;
      return `${i.first_name} ${i.last_name} ${i.email} ${i.phone ?? ""}`.toLowerCase().includes(q);
    });
  }, [investors, search, statusFilter]);

  const totalCents = filtered.reduce((s, i) => s + (i.amount_cents || 0), 0);

  const openCreate = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (i: Investor) => {
    setForm({
      id: i.id,
      first_name: i.first_name,
      last_name: i.last_name,
      email: i.email,
      phone: i.phone ?? "",
      amount: ((i.amount_cents || 0) / 100).toFixed(2),
      status: i.status,
      notes: i.notes ?? "",
    });
    setOpen(true);
  };

  const canSubmit = form.first_name.trim() && form.last_name.trim() && form.email.trim();

  return (
    <div>
      <AdminTopBar
        title="Investisseurs"
        subtitle="Gestion des investisseurs au capital MediKong"
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus size={15} /> Ajouter
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-[#8B95A5] uppercase tracking-wide font-medium">Investisseurs affichés</p>
            <Users size={16} style={{ color: "#1B5BDA" }} />
          </div>
          <p className="text-xl font-bold text-[#1D2530]">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
          <p className="text-[11px] text-[#8B95A5] uppercase tracking-wide font-medium mb-1.5">Montant total</p>
          <p className="text-xl font-bold" style={{ color: "#059669" }}>{fmtEurFromCents(totalCents)} €</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
          <p className="text-[11px] text-[#8B95A5] uppercase tracking-wide font-medium mb-1.5">Signés / payés</p>
          <p className="text-xl font-bold text-[#1D2530]">
            {filtered.filter((i) => i.status === "signed" || i.status === "paid").length}
          </p>
        </div>
      </div>

      {/* Recherche + filtre */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un nom, prénom, e-mail…"
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUS_KEYS.map((s) => (
              <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto" style={{ borderColor: "#E2E8F0" }}>
        {isLoading ? (
          <div className="p-8 text-center text-[#8B95A5]">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[#8B95A5]">Aucun investisseur</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b text-[11px] text-[#8B95A5] uppercase tracking-wide" style={{ borderColor: "#E2E8F0" }}>
                <th className="text-left py-2.5 px-3 font-medium">Date</th>
                <th className="text-left py-2.5 px-3 font-medium">Nom</th>
                <th className="text-left py-2.5 px-3 font-medium">Prénom</th>
                <th className="text-left py-2.5 px-3 font-medium">E-mail</th>
                <th className="text-right py-2.5 px-3 font-medium">Montant investi</th>
                <th className="text-center py-2.5 px-3 font-medium">Statut</th>
                <th className="text-right py-2.5 px-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const sc = STATUS[i.status] ?? STATUS.pending;
                return (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-[#F8FAFC]" style={{ borderColor: "#E2E8F0" }}>
                    <td className="py-2.5 px-3 text-[#8B95A5] whitespace-nowrap">
                      {new Date(i.created_at).toLocaleDateString("fr-BE")}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#1D2530]">{i.last_name}</td>
                    <td className="py-2.5 px-3 text-[#616B7C]">{i.first_name}</td>
                    <td className="py-2.5 px-3 text-[#616B7C]">{i.email}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#1D2530] whitespace-nowrap">
                      {fmtEurFromCents(i.amount_cents)} €
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)} aria-label="Modifier">
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Supprimer"
                          onClick={() => {
                            if (confirm(`Supprimer ${i.first_name} ${i.last_name} ?`)) remove.mutate(i.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier l'investisseur" : "Nouvel investisseur"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom *</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Montant investi (€)</Label>
              <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InvestorStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_KEYS.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
