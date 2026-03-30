import { Layout } from "@/components/layout/Layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Factory, Search, Globe, Award, Package, Tag } from "lucide-react";

const FLAG: Record<string, string> = { BE: "🇧🇪", FR: "🇫🇷", DE: "🇩🇪", NL: "🇳🇱", SE: "🇸🇪", DK: "🇩🇰", GB: "🇬🇧", US: "🇺🇸", CH: "🇨🇭", JP: "🇯🇵" };

const usePublicManufacturers = () =>
  useQuery({
    queryKey: ["public-manufacturers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("manufacturers").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

export default function FabricantsPage() {
  const { data: manufacturers = [], isLoading } = usePublicManufacturers();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");

  const countries = [...new Set(manufacturers.map(m => m.country_of_origin).filter(Boolean))].sort();

  const filtered = manufacturers.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const matchCountry = countryFilter === "all" || m.country_of_origin === countryFilter;
    return matchSearch && matchCountry;
  });

  return (
    <Layout>
      <PageTransition>
        <div className="mk-container py-6 md:py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy mb-1">Nos fabricants</h1>
            <p className="text-sm text-mk-sec mb-6">{manufacturers.length} fabricants référencés</p>
          </motion.div>

          <div className="flex gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-ter" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un fabricant..." className="pl-9" />
            </div>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tous les pays" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les pays</SelectItem>
                {countries.map(c => <SelectItem key={c!} value={c!}>{FLAG[c!] || ""} {c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-mk-sec">Chargement...</div>
          ) : (
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              {filtered.map((m, i) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Link to={`/fabricant/${m.slug}`} className="block border border-mk-line rounded-lg p-5 hover:shadow-md hover:border-mk-blue transition-all group">
                    <div className="flex items-center gap-3 mb-3">
                      {m.logo_url ? (
                        <img src={m.logo_url} alt={m.name} className="w-10 h-10 rounded object-contain" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-mk-alt flex items-center justify-center"><Factory size={20} className="text-mk-sec" /></div>
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-mk-navy group-hover:text-mk-blue transition-colors">{m.name}</h3>
                        {m.country_of_origin && <span className="text-xs text-mk-sec">{FLAG[m.country_of_origin] || ""} {m.country_of_origin}</span>}
                      </div>
                    </div>

                    <div className="flex gap-4 text-[11px] text-mk-sec mb-3">
                      <span className="flex items-center gap-1"><Tag size={12} />{m.brand_count || 0} marques</span>
                      <span className="flex items-center gap-1"><Package size={12} />{m.product_count || 0} produits</span>
                    </div>

                    {(m.certifications || []).length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-2">
                        {(m.certifications as string[]).slice(0, 4).map(c => (
                          <Badge key={c} variant="outline" className="text-[9px] px-1.5 py-0">{c}</Badge>
                        ))}
                      </div>
                    )}

                    {(m.specialties || []).length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {(m.specialties as string[]).slice(0, 3).map(s => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-mk-blue">{s}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12">
              <Factory size={48} className="mx-auto text-mk-ter mb-3" />
              <p className="text-mk-sec">Aucun fabricant trouvé</p>
            </div>
          )}
        </div>
      </PageTransition>
    </Layout>
  );
}
