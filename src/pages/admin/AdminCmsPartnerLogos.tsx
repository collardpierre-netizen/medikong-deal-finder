import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save, Trash2, Eye, EyeOff, Loader2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface PartnerLogo {
  id: string;
  placement: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  domain: string | null;
  sort_order: number;
  is_active: boolean;
}

const PLACEMENT = "invest";

function resolvedLogoSrc(p: Pick<PartnerLogo, "logo_url" | "domain">) {
  if (p.logo_url && p.logo_url.trim()) return p.logo_url.trim();
  if (p.domain && p.domain.trim()) return `https://logo.clearbit.com/${p.domain.trim()}?size=128`;
  return "";
}

export default function AdminCmsPartnerLogos() {
  const qc = useQueryClient();
  const sb = supabase as any;

  const { data: logos = [], isLoading } = useQuery<PartnerLogo[]>({
    queryKey: ["admin-cms-partner-logos", PLACEMENT],
    queryFn: async () => {
      const { data, error } = await sb
        .from("cms_partner_logos")
        .select("*")
        .eq("placement", PLACEMENT)
        .order("sort_order");
      if (error) throw error;
      return data as PartnerLogo[];
    },
  });

  const [draft, setDraft] = useState<Record<string, Partial<PartnerLogo>>>({});
  const patch = (id: string, p: Partial<PartnerLogo>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  const merged = (l: PartnerLogo): PartnerLogo => ({ ...l, ...(draft[l.id] || {}) });

  const saveMutation = useMutation({
    mutationFn: async (l: PartnerLogo) => {
      const { error } = await sb
        .from("cms_partner_logos")
        .update({
          name: l.name,
          website_url: l.website_url,
          logo_url: l.logo_url,
          domain: l.domain,
          sort_order: l.sort_order,
          is_active: l.is_active,
        })
        .eq("id", l.id);
      if (error) throw error;
    },
    onSuccess: (_d, l) => {
      toast.success("Logo enregistré");
      setDraft((d) => {
        const { [l.id]: _, ...rest } = d;
        return rest;
      });
      qc.invalidateQueries({ queryKey: ["admin-cms-partner-logos", PLACEMENT] });
      qc.invalidateQueries({ queryKey: ["cms-partner-logos", PLACEMENT] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("cms_partner_logos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin-cms-partner-logos", PLACEMENT] });
      qc.invalidateQueries({ queryKey: ["cms-partner-logos", PLACEMENT] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const nextSort = logos.length ? Math.max(...logos.map((l) => l.sort_order)) + 10 : 10;
      const { error } = await sb.from("cms_partner_logos").insert({
        placement: PLACEMENT,
        name: "Nouveau partenaire",
        sort_order: nextSort,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-partner-logos", PLACEMENT] });
      qc.invalidateQueries({ queryKey: ["cms-partner-logos", PLACEMENT] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reorder = (id: string, dir: -1 | 1) => {
    const idx = logos.findIndex((l) => l.id === id);
    const swap = logos[idx + dir];
    if (!swap) return;
    saveMutation.mutate({ ...logos[idx], sort_order: swap.sort_order });
    saveMutation.mutate({ ...swap, sort_order: logos[idx].sort_order });
  };

  return (
    <div>
      <AdminTopBar />
      <div className="max-w-6xl mx-auto px-5 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-mk-navy">CMS — Logos partenaires (page Invest)</h1>
            <p className="text-sm text-mk-sec">
              Section "Ils nous font confiance" sur <a href="/invest" target="_blank" rel="noreferrer" className="text-mk-blue underline">/invest</a>.
              Renseignez une URL de logo, ou seulement le domaine pour utiliser le logo Clearbit automatiquement.
            </p>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus className="size-4 mr-1" /> Ajouter
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-mk-sec" /></div>
        ) : (
          <div className="bg-white border border-mk-line rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-mk-alt text-xs text-mk-sec">
                <tr>
                  <th className="text-left py-2 px-3 w-24">Aperçu</th>
                  <th className="text-left py-2 px-3">Nom</th>
                  <th className="text-left py-2 px-3">Domaine (Clearbit)</th>
                  <th className="text-left py-2 px-3">URL logo (override)</th>
                  <th className="text-left py-2 px-3">Site web</th>
                  <th className="text-center py-2 px-3 w-16">Ordre</th>
                  <th className="text-center py-2 px-3 w-16">Actif</th>
                  <th className="text-right py-2 px-3 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logos.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-mk-sec text-xs">Aucun logo. Cliquez "Ajouter".</td></tr>
                )}
                {logos.map((raw) => {
                  const l = merged(raw);
                  const dirty = !!draft[l.id];
                  const src = resolvedLogoSrc(l);
                  return (
                    <tr key={l.id} className="border-t border-mk-line align-middle">
                      <td className="py-2 px-3">
                        <div className="h-10 w-20 bg-mk-alt rounded flex items-center justify-center overflow-hidden">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt={l.name} className="h-8 w-auto object-contain"
                              onError={(e) => {
                                const el = e.currentTarget;
                                el.onerror = null;
                                el.style.display = "none";
                              }} />
                          ) : (
                            <span className="text-[10px] text-mk-ter">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Input value={l.name} onChange={(e) => patch(l.id, { name: e.target.value })} className="h-8" />
                      </td>
                      <td className="py-2 px-3">
                        <Input value={l.domain || ""} placeholder="exemple.com" onChange={(e) => patch(l.id, { domain: e.target.value })} className="h-8" />
                      </td>
                      <td className="py-2 px-3">
                        <Input value={l.logo_url || ""} placeholder="https://... (optionnel)" onChange={(e) => patch(l.id, { logo_url: e.target.value })} className="h-8" />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <Input value={l.website_url || ""} placeholder="https://..." onChange={(e) => patch(l.id, { website_url: e.target.value })} className="h-8" />
                          {l.website_url && (
                            <a href={l.website_url} target="_blank" rel="noreferrer" className="text-mk-sec hover:text-mk-blue"><ExternalLink className="size-4" /></a>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => reorder(l.id, -1)} className="text-mk-sec hover:text-mk-navy"><ArrowUp className="size-4" /></button>
                          <button onClick={() => reorder(l.id, 1)} className="text-mk-sec hover:text-mk-navy"><ArrowDown className="size-4" /></button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => patch(l.id, { is_active: !l.is_active })}>
                          {l.is_active ? <Eye className="size-4 text-mk-green mx-auto" /> : <EyeOff className="size-4 text-mk-ter mx-auto" />}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || saveMutation.isPending}
                            onClick={() => saveMutation.mutate(l)}>
                            <Save className="size-4 mr-1" /> {dirty ? "Enregistrer" : "À jour"}
                          </Button>
                          <button onClick={() => { if (confirm(`Supprimer "${l.name}" ?`)) deleteMutation.mutate(l.id); }}
                            className="text-mk-sec hover:text-mk-red"><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
