import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search, Shield, Package, ArrowLeftRight, Truck, Receipt, Lock } from "lucide-react";
import { useState } from "react";

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  legal: { label: "Cadre légal", icon: Shield, color: "#1C58D9" },
  product: { label: "Produits", icon: Package, color: "#00B85C" },
  transaction: { label: "Transaction & responsabilité", icon: ArrowLeftRight, color: "#F59E0B" },
  logistics: { label: "Logistique", icon: Truck, color: "#8B5CF6" },
  tax: { label: "Fiscalité", icon: Receipt, color: "#E54545" },
  confidentiality: { label: "Confidentialité", icon: Lock, color: "#5C6470" },
};

export default function RestockFaqPage() {
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["restock-faq"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faq_items")
        .select("*")
        .eq("is_published", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Track view count on expand
  const viewMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.rpc("increment_faq_view", { faq_id: id }).catch(() => {
        // RPC might not exist yet, silently fail
      });
    },
  });

  const filtered = search.trim()
    ? items.filter(
        (i: any) =>
          i.question.toLowerCase().includes(search.toLowerCase()) ||
          i.answer_html.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const categories = [...new Set(filtered.map((i: any) => i.category))];

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Shield size={28} className="text-[#1C58D9]" />
        <h1 className="text-2xl font-bold text-[#1E252F]">FAQ réglementaire & juridique</h1>
      </div>

      {/* Disclaimer */}
      <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 mb-6 flex gap-3">
        <AlertTriangle size={20} className="text-[#F59E0B] shrink-0 mt-0.5" />
        <p className="text-sm text-[#5C6470]">
          Cette FAQ est informative et ne se substitue pas à un conseil juridique individualisé.
          En cas de doute, consultez votre Ordre Provincial des Pharmaciens.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B929C]" />
        <Input
          placeholder="Rechercher dans la FAQ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-[#D0D5DC] rounded-lg"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#8B929C]">Aucun résultat trouvé</div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat as string] || { label: cat, icon: Shield, color: "#5C6470" };
            const Icon = meta.icon;
            const catItems = filtered.filter((i: any) => i.category === cat);

            return (
              <div key={cat as string} className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-[#D0D5DC] flex items-center gap-2" style={{ borderLeftColor: meta.color, borderLeftWidth: 4 }}>
                  <Icon size={18} style={{ color: meta.color }} />
                  <h2 className="text-sm font-bold text-[#1E252F] uppercase tracking-wider">{meta.label}</h2>
                  <Badge variant="outline" className="ml-auto text-[10px]">{catItems.length}</Badge>
                </div>
                <Accordion type="multiple" className="px-2">
                  {catItems.map((item: any) => (
                    <AccordionItem key={item.id} value={item.id}>
                      <AccordionTrigger
                        className="text-sm font-medium text-[#1E252F] text-left px-3"
                        onClick={() => viewMutation.mutate(item.id)}
                      >
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-4">
                        <div
                          className="text-sm text-[#5C6470] prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: item.answer_html }}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
