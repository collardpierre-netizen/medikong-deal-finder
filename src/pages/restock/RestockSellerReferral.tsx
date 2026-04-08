import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Share2, Users, CheckCircle, Award } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function RestockSellerReferral() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: referralData } = useQuery({
    queryKey: ["restock-referral", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get or create referral code
      const { data: existing } = await supabase
        .from("restock_referral_codes")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existing) return existing;

      // Create one
      const code = `MK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { data: created, error } = await supabase
        .from("restock_referral_codes")
        .insert({ user_id: user!.id, code })
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ["restock-referrals-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_referrals")
        .select("*")
        .eq("referrer_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const referralLink = referralData?.code
    ? `${window.location.origin}/restock/r/${referralData.code}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Rejoignez MediKong ReStock et vendez vos surplus pharma ! ${referralLink}`)}`, "_blank");
  };

  const pending = referrals.filter((r: any) => r.status === "pending").length;
  const active = referrals.filter((r: any) => r.status === "active").length;
  const rewarded = referrals.filter((r: any) => r.status === "rewarded").length;

  return (
    <div className="p-6 max-w-3xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[#F0F4FF]">
          <Gift size={22} className="text-[#1C58D9]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1E252F]">Programme de parrainage</h1>
          <p className="text-sm text-[#5C6470]">Parrainez un confrère et gagnez des récompenses</p>
        </div>
      </div>

      {/* Reward info */}
      <div className="bg-gradient-to-r from-[#1C58D9] to-[#1549B8] rounded-xl p-6 text-white mb-6">
        <div className="flex items-start gap-4">
          <Award size={32} className="shrink-0 opacity-80" />
          <div>
            <h2 className="text-lg font-bold mb-1">50 € de crédit offerts</h2>
            <p className="text-white/80 text-sm">
              Pour chaque confrère parrainé qui réalise sa première transaction réussie,
              recevez 50 € de crédit sur vos prochains achats ReStock.
            </p>
          </div>
        </div>
      </div>

      {/* Link */}
      <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 mb-6 shadow-sm">
        <label className="text-sm font-medium text-[#1E252F] mb-2 block">Votre lien de parrainage</label>
        <div className="flex gap-2">
          <Input value={referralLink} readOnly className="font-mono text-sm border-[#D0D5DC]" />
          <Button onClick={copyLink} variant="outline" className="gap-2 border-[#D0D5DC] text-[#1C58D9]">
            <Copy size={16} /> {copied ? "Copié !" : "Copier"}
          </Button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={shareWhatsApp} variant="outline" className="gap-2 text-[#00B85C] border-[#00B85C]/30">
            <Share2 size={16} /> WhatsApp
          </Button>
          <Button variant="outline" className="gap-2 text-[#1C58D9] border-[#1C58D9]/30"
            onClick={() => window.open(`mailto:?subject=Rejoignez MediKong ReStock&body=${encodeURIComponent(`Vendez vos surplus pharma sur MediKong ReStock : ${referralLink}`)}`)}>
            <Share2 size={16} /> Email
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 text-center shadow-sm">
          <Users size={20} className="mx-auto mb-1 text-[#1C58D9]" />
          <p className="text-2xl font-bold text-[#1E252F]">{referrals.length}</p>
          <p className="text-xs text-[#8B929C]">Filleuls inscrits</p>
        </div>
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 text-center shadow-sm">
          <CheckCircle size={20} className="mx-auto mb-1 text-[#00B85C]" />
          <p className="text-2xl font-bold text-[#1E252F]">{active + rewarded}</p>
          <p className="text-xs text-[#8B929C]">Ont transactioné</p>
        </div>
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-4 text-center shadow-sm">
          <Gift size={20} className="mx-auto mb-1 text-[#F59E0B]" />
          <p className="text-2xl font-bold text-[#1E252F]">{rewarded * 50} €</p>
          <p className="text-xs text-[#8B929C]">Crédits gagnés</p>
        </div>
      </div>

      {/* Referral list */}
      {referrals.length > 0 && (
        <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#D0D5DC] bg-[#F7F8FA]">
            <h3 className="text-sm font-bold text-[#1E252F]">Vos filleuls</h3>
          </div>
          {referrals.map((r: any) => (
            <div key={r.id} className="px-4 py-3 border-b border-[#D0D5DC]/50 flex items-center justify-between">
              <span className="text-sm text-[#5C6470]">Filleul inscrit le {new Date(r.created_at).toLocaleDateString("fr-BE")}</span>
              <Badge className={
                r.status === "rewarded" ? "bg-[#EEFBF4] text-[#00B85C]" :
                r.status === "active" ? "bg-[#F0F4FF] text-[#1C58D9]" :
                "bg-[#F7F8FA] text-[#8B929C]"
              }>
                {r.status === "rewarded" ? "Récompensé" : r.status === "active" ? "Actif" : "En attente"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
