import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, ShieldAlert, UserCheck, Building2, AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Mismatch {
  vendor_id: string;
  vendor_name: string | null;
  company_name: string | null;
  current_owner_user_id: string | null;
  current_owner_email: string | null;
  current_owner_has_auth: boolean;
  suggested_user_id: string | null;
  suggested_user_email: string | null;
  suggested_user_full_name: string | null;
  suggested_role: string | null;
  suggested_accepted_at: string | null;
  pending_invitations_count: number;
  reason: "owner_missing" | "owner_no_auth" | "owner_not_member" | null;
}

const REASON_LABEL: Record<string, { label: string; tone: string }> = {
  owner_missing: { label: "Owner non défini", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  owner_no_auth: { label: "Owner sans compte auth", tone: "bg-red-50 text-red-700 border-red-200" },
  owner_not_member: { label: "Owner n'est plus membre actif", tone: "bg-orange-50 text-orange-700 border-orange-200" },
};

export default function AdminVendorOwnerAlignment() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const queryKey = ["admin-vendor-owner-mismatches"];

  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Mismatch[]> => {
      const { data, error } = await (supabase.rpc as any)("admin_list_vendor_owner_mismatches");
      if (error) throw error;
      return (data || []) as Mismatch[];
    },
  });

  const align = useMutation({
    mutationFn: async (payload: { vendor_id: string; user_id: string }) => {
      const { data, error } = await (supabase.rpc as any)("admin_align_vendor_owner", {
        _vendor_id: payload.vendor_id,
        _user_id: payload.user_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Owner aligné");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur d'alignement"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      (r.vendor_name || "").toLowerCase().includes(q) ||
      (r.company_name || "").toLowerCase().includes(q) ||
      (r.current_owner_email || "").toLowerCase().includes(q) ||
      (r.suggested_user_email || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1D2530] flex items-center gap-2">
          <ShieldAlert size={22} className="text-amber-600" />
          Alignement Owner vendeurs
        </h1>
        <p className="text-sm text-[#616B7C] mt-1">
          Vendeurs dont <code className="px-1 bg-slate-100 rounded">owner_user_id</code> est manquant,
          pointe vers un compte auth supprimé, ou n'est plus membre actif. Suggestion = admin membre le plus ancien.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-white border border-[#E2E8F0] rounded-lg p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Vendeur, société, email…" className="pl-9 h-9" />
        </div>
        <div className="text-xs text-[#8B95A5] ml-auto">{filtered.length} / {data.length}</div>
      </div>

      <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#8B95A5]" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#8B95A5]">
            <UserCheck className="inline mr-2 text-emerald-600" size={16} />
            Tous les owners vendeurs sont alignés.
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {filtered.map((row) => {
              const reason = row.reason ? REASON_LABEL[row.reason] : null;
              const canAlign = !!row.suggested_user_id;
              return (
                <div key={row.vendor_id} className="px-4 py-4 flex flex-wrap items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#616B7C] shrink-0">
                    <Building2 size={14} />
                  </div>
                  <div className="flex-1 min-w-[280px] space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-[#1D2530]">
                        {row.company_name || row.vendor_name || "—"}
                      </span>
                      {reason && (
                        <Badge variant="outline" className={`${reason.tone} text-[10px] font-bold uppercase`}>
                          <AlertTriangle size={10} className="mr-1" /> {reason.label}
                        </Badge>
                      )}
                      {row.pending_invitations_count > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          <Mail size={10} className="mr-1" /> {row.pending_invitations_count} invitation(s)
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8B95A5] grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
                      <span>
                        <strong className="text-[#616B7C]">Owner actuel :</strong>{" "}
                        {row.current_owner_user_id ? (
                          <>
                            {row.current_owner_email || row.current_owner_user_id}
                            {!row.current_owner_has_auth && <span className="text-red-600"> (compte supprimé)</span>}
                          </>
                        ) : (
                          <span className="text-amber-700">— aucun —</span>
                        )}
                      </span>
                      <span>
                        <strong className="text-[#616B7C]">Suggestion :</strong>{" "}
                        {row.suggested_user_id ? (
                          <>
                            {row.suggested_user_full_name || row.suggested_user_email || row.suggested_user_id}
                            {row.suggested_role && (
                              <span className="ml-1 text-[10px] uppercase">({row.suggested_role})</span>
                            )}
                          </>
                        ) : (
                          <span className="text-red-600">Aucun membre actif — invitez d'abord</span>
                        )}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8B95A5]">vendor_id : {row.vendor_id}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!canAlign || align.isPending}
                      onClick={() => {
                        if (!row.suggested_user_id) return;
                        if (confirm(`Aligner l'owner de ${row.company_name || row.vendor_name} sur ${row.suggested_user_email || row.suggested_user_id} ?`)) {
                          align.mutate({ vendor_id: row.vendor_id, user_id: row.suggested_user_id });
                        }
                      }}
                    >
                      <UserCheck size={14} className="mr-1.5" />
                      Aligner sur la suggestion
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
