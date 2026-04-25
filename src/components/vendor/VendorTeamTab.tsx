import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2, Upload, Mail, Phone, CalendarDays, MapPin, Users, Globe, User as UserIcon, Search, X, Star, Clock, CheckCircle2, Plane, AlertOctagon, CalendarClock } from "lucide-react";

interface Props {
  vendor: any;
}

type AvailabilityStatus = "available" | "busy" | "in_meeting" | "on_leave" | "unavailable";

interface Delegate {
  id: string;
  vendor_id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  booking_url: string | null;
  photo_url: string | null;
  bio: string | null;
  languages: string[];
  country_codes: string[];
  regions: string[];
  postal_codes: string[];
  target_profiles: string[];
  primary_target_profiles: string[];
  is_active: boolean;
  display_order: number;
  availability_status: AvailabilityStatus;
  availability_message: string | null;
  availability_until: string | null;
}

const AVAILABILITY_OPTIONS: {
  value: AvailabilityStatus;
  label: string;
  short: string;
  dot: string;
  bg: string;
  text: string;
  border: string;
  Icon: typeof CheckCircle2;
}[] = [
  { value: "available",   label: "Disponible",        short: "Dispo",      dot: "#10B981", bg: "#D1FAE5", text: "#065F46", border: "#10B981", Icon: CheckCircle2 },
  { value: "busy",        label: "Occupé·e",          short: "Occupé",     dot: "#F59E0B", bg: "#FEF3C7", text: "#92400E", border: "#F59E0B", Icon: Clock },
  { value: "in_meeting",  label: "En rendez-vous",    short: "En RDV",     dot: "#6366F1", bg: "#E0E7FF", text: "#3730A3", border: "#6366F1", Icon: CalendarClock },
  { value: "on_leave",    label: "En congé",          short: "En congé",   dot: "#0EA5E9", bg: "#E0F2FE", text: "#075985", border: "#0EA5E9", Icon: Plane },
  { value: "unavailable", label: "Indisponible",      short: "Indispo",    dot: "#EF4343", bg: "#FEE2E2", text: "#991B1B", border: "#EF4343", Icon: AlertOctagon },
];

const AVAILABILITY_BY_VALUE: Record<AvailabilityStatus, typeof AVAILABILITY_OPTIONS[number]> =
  AVAILABILITY_OPTIONS.reduce((acc, o) => ({ ...acc, [o.value]: o }), {} as any);

const LANGUAGES = ["fr", "nl", "en", "de", "lu", "es", "it", "pt", "ar", "tr", "pl", "ro"];
const LANGUAGE_LABELS: Record<string, string> = {
  fr: "Français", nl: "Nederlands", en: "English", de: "Deutsch", lu: "Lëtzebuergesch",
  es: "Español", it: "Italiano", pt: "Português", ar: "العربية", tr: "Türkçe", pl: "Polski", ro: "Română",
};

const COUNTRIES = ["BE", "FR", "NL", "LU", "DE"];
const COUNTRY_LABELS: Record<string, string> = { BE: "Belgique", FR: "France", NL: "Pays-Bas", LU: "Luxembourg", DE: "Allemagne" };

const REGIONS_BY_COUNTRY: Record<string, string[]> = {
  BE: ["Flandre", "Wallonie", "Bruxelles", "Anvers", "Liège", "Hainaut", "Luxembourg (BE)", "Namur", "Brabant flamand", "Brabant wallon", "Flandre orientale", "Flandre occidentale", "Limbourg"],
  FR: ["Île-de-France", "Hauts-de-France", "Grand Est", "Normandie", "Bretagne", "Pays de la Loire", "Centre-Val de Loire", "Bourgogne-Franche-Comté", "Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur", "Occitanie", "Nouvelle-Aquitaine", "Corse"],
  NL: ["Noord-Holland", "Zuid-Holland", "Utrecht", "Noord-Brabant", "Gelderland", "Limburg", "Overijssel", "Friesland", "Groningen", "Drenthe", "Flevoland", "Zeeland"],
  LU: ["Luxembourg-Ville", "Esch-sur-Alzette", "Nord", "Sud", "Est"],
  DE: ["Bayern", "Berlin", "NRW", "Hamburg", "Hessen", "Sachsen", "Baden-Württemberg"],
};

const TARGET_PROFILES = [
  { value: "pharmacy", label: "Pharmacies" },
  { value: "parapharmacy", label: "Parapharmacies" },
  { value: "wholesaler", label: "Grossistes" },
  { value: "hospital", label: "Hôpitaux / Cliniques" },
  { value: "dentist", label: "Dentistes" },
  { value: "veterinary", label: "Vétérinaires" },
  { value: "ehpad", label: "EHPAD / Maisons de repos" },
  { value: "medical_practice", label: "Cabinets médicaux" },
  { value: "optician", label: "Opticiens" },
  { value: "physiotherapist", label: "Kinésithérapeutes" },
  { value: "midwife", label: "Sages-femmes" },
  { value: "laboratory", label: "Laboratoires" },
  { value: "school", label: "Écoles / Crèches" },
  { value: "community", label: "Collectivités" },
  { value: "beauty_salon", label: "Instituts de beauté / Spas" },
  { value: "sports_club", label: "Clubs sportifs" },
];

const empty: Omit<Delegate, "id" | "vendor_id"> = {
  first_name: "", last_name: "", job_title: "", email: "", phone: "", booking_url: "", photo_url: "", bio: "",
  languages: [], country_codes: [], regions: [], postal_codes: [], target_profiles: [], primary_target_profiles: [], is_active: true, display_order: 0,
  availability_status: "available", availability_message: "", availability_until: null,
};

export default function VendorTeamTab({ vendor }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Delegate | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filtres liste
  const [filterSearch, setFilterSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterProfile, setFilterProfile] = useState<string>("");
  const [filterLanguage, setFilterLanguage] = useState<string>("");

  const { data: delegates = [], isLoading } = useQuery<Delegate[]>({
    queryKey: ["vendor-delegates", vendor.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_delegates" as any)
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Delegate[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.first_name.trim() || !form.last_name.trim()) {
        throw new Error("Prénom et nom obligatoires");
      }
      // Normalise l'URL d'agenda : ajoute https:// si manquant, valide format
      let bookingUrl = (form.booking_url || "").trim();
      if (bookingUrl) {
        if (!/^https?:\/\//i.test(bookingUrl)) bookingUrl = "https://" + bookingUrl;
        try {
          const u = new URL(bookingUrl);
          if (!/^https?:$/.test(u.protocol)) throw new Error("invalid");
        } catch {
          throw new Error("Lien d'agenda invalide. Utilise une URL complète (https://…)");
        }
      }
      const payload = { ...form, booking_url: bookingUrl || null, vendor_id: vendor.id };
      if (editing) {
        const { error } = await supabase.from("vendor_delegates" as any).update(payload as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vendor_delegates" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Délégué mis à jour" : "Délégué ajouté");
      qc.invalidateQueries({ queryKey: ["vendor-delegates", vendor.id] });
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_delegates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Délégué supprimé");
      qc.invalidateQueries({ queryKey: ["vendor-delegates", vendor.id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, display_order: delegates.length });
    setDialogOpen(true);
  };

  const openEdit = (d: Delegate) => {
    setEditing(d);
    setForm({
      first_name: d.first_name, last_name: d.last_name, job_title: d.job_title || "",
      email: d.email || "", phone: d.phone || "", booking_url: d.booking_url || "",
      photo_url: d.photo_url || "", bio: d.bio || "",
      languages: d.languages || [], country_codes: d.country_codes || [],
      regions: d.regions || [], postal_codes: d.postal_codes || [], target_profiles: d.target_profiles || [],
      primary_target_profiles: d.primary_target_profiles || [],
      is_active: d.is_active, display_order: d.display_order,
      availability_status: (d.availability_status || "available") as AvailabilityStatus,
      availability_message: d.availability_message || "",
      availability_until: d.availability_until || null,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(empty); };

  const toggle = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Image uniquement"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Max 2 Mo"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${vendor.id}/delegate-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("vendor-delegates").upload(path, file, {
        upsert: true, contentType: file.type, cacheControl: "3600",
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("vendor-delegates").getPublicUrl(path);
      setForm(f => ({ ...f, photo_url: pub.publicUrl }));
      toast.success("Photo téléversée");
    } catch (err: any) {
      toast.error(err.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    form.country_codes.forEach(c => REGIONS_BY_COUNTRY[c]?.forEach(r => set.add(r)));
    return Array.from(set).sort();
  }, [form.country_codes]);

  // Régions disponibles dans le filtre (selon pays sélectionné)
  const filterAvailableRegions = useMemo(() => {
    if (filterCountry) return REGIONS_BY_COUNTRY[filterCountry] || [];
    return Array.from(new Set(delegates.flatMap(d => d.regions || []))).sort();
  }, [filterCountry, delegates]);

  const filteredDelegates = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return delegates.filter(d => {
      if (q) {
        const hay = `${d.first_name} ${d.last_name} ${d.job_title || ""} ${d.email || ""} ${d.phone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterCountry && !d.country_codes.includes(filterCountry)) return false;
      if (filterRegion && !d.regions.includes(filterRegion)) return false;
      if (filterProfile && !d.target_profiles.includes(filterProfile)) return false;
      if (filterLanguage && !d.languages.includes(filterLanguage)) return false;
      return true;
    });
  }, [delegates, filterSearch, filterCountry, filterRegion, filterProfile, filterLanguage]);

  const hasActiveFilters = filterSearch || filterCountry || filterRegion || filterProfile || filterLanguage;
  const clearFilters = () => {
    setFilterSearch(""); setFilterCountry(""); setFilterRegion(""); setFilterProfile(""); setFilterLanguage("");
  };

  // Mapping segment → responsables (référent principal en premier, puis contacts secondaires)
  const responsibilitiesBySegment = useMemo(() => {
    const map = new Map<string, { primary: Delegate[]; secondary: Delegate[] }>();
    const active = delegates.filter(d => d.is_active);
    TARGET_PROFILES.forEach(({ value }) => {
      const primary = active.filter(d => (d.primary_target_profiles || []).includes(value));
      const secondary = active.filter(
        d => d.target_profiles.includes(value) && !(d.primary_target_profiles || []).includes(value)
      );
      if (primary.length > 0 || secondary.length > 0) {
        map.set(value, { primary, secondary });
      }
    });
    return map;
  }, [delegates]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#1B5BDA]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-[#1D2530]">Équipe commerciale</h2>
          <p className="text-[12px] text-[#8B95A5] mt-0.5">
            Vos délégués sont visibles par les acheteurs vérifiés selon leur profil et leur région.
          </p>
        </div>
        <VBtn primary small onClick={openNew}><Plus size={14} className="mr-1" />Ajouter un délégué</VBtn>
      </div>

      {delegates.length === 0 ? (
        <VCard>
          <div className="text-center py-12">
            <Users size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-[13px] text-[#8B95A5]">Aucun délégué encodé pour l'instant.</p>
          </div>
        </VCard>
      ) : (
        <>
          {/* Vue Responsables par segment */}
          {responsibilitiesBySegment.size > 0 && (
            <VCard>
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} className="text-[#F59E0B] fill-[#F59E0B]" />
                <h3 className="text-[13px] font-bold text-[#1D2530]">Responsables par segment</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {Array.from(responsibilitiesBySegment.entries()).map(([segment, { primary, secondary }]) => {
                  const lbl = TARGET_PROFILES.find(tp => tp.value === segment)?.label || segment;
                  return (
                    <div key={segment} className="flex items-start gap-2 py-1 border-b border-[#F1F5F9] last:border-0">
                      <div className="text-[12px] font-semibold text-[#1D2530] min-w-[100px] flex-shrink-0">
                        {lbl}
                      </div>
                      <div className="flex-1 text-[11px] text-[#616B7C]">
                        {primary.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {primary.map(d => (
                              <span key={d.id} className="inline-flex items-center gap-1 font-semibold text-[#92400E]">
                                <Star size={9} className="fill-[#F59E0B] text-[#F59E0B]" />
                                {d.first_name} {d.last_name}
                              </span>
                            ))}
                            {secondary.length > 0 && (
                              <span className="text-[#8B95A5]">
                                + {secondary.map(d => `${d.first_name} ${d.last_name}`).join(", ")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="italic text-[#8B95A5]">
                            Aucun référent — {secondary.map(d => `${d.first_name} ${d.last_name}`).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#8B95A5] mt-3">
                <Star size={9} className="inline fill-[#F59E0B] text-[#F59E0B] mr-1" />
                = référent principal (affiché en priorité aux acheteurs du segment).
              </p>
            </VCard>
          )}

          {/* Barre de filtres */}
          <VCard>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
                <input
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Rechercher (nom, email, téléphone…)"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white pl-8 pr-3 py-1.5 text-[12px] text-[#1D2530] focus:outline-none focus:border-[#1B5BDA]"
                />
              </div>
              <select
                value={filterCountry}
                onChange={(e) => { setFilterCountry(e.target.value); setFilterRegion(""); }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12px] text-[#1D2530] focus:outline-none focus:border-[#1B5BDA]"
              >
                <option value="">Tous pays</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_LABELS[c]}</option>)}
              </select>
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12px] text-[#1D2530] focus:outline-none focus:border-[#1B5BDA] max-w-[180px]"
              >
                <option value="">Toutes régions</option>
                {filterAvailableRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12px] text-[#1D2530] focus:outline-none focus:border-[#1B5BDA]"
              >
                <option value="">Toutes cibles</option>
                {TARGET_PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12px] text-[#1D2530] focus:outline-none focus:border-[#1B5BDA]"
              >
                <option value="">Toutes langues</option>
                {LANGUAGES.map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}
              </select>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-[11px] text-[#EF4343] hover:underline px-2 py-1"
                >
                  <X size={11} /> Effacer
                </button>
              )}
            </div>
            <div className="text-[11px] text-[#8B95A5] mt-2">
              {filteredDelegates.length} / {delegates.length} délégué{delegates.length > 1 ? "s" : ""}
            </div>
          </VCard>

          {filteredDelegates.length === 0 ? (
            <VCard>
              <div className="text-center py-8">
                <p className="text-[13px] text-[#8B95A5]">Aucun délégué ne correspond aux filtres.</p>
              </div>
            </VCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDelegates.map(d => {
                const av = AVAILABILITY_BY_VALUE[d.availability_status] || AVAILABILITY_BY_VALUE.available;
                return (
            <VCard key={d.id} className={!d.is_active ? "opacity-60" : ""}>
              <div className="flex gap-3">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center overflow-hidden">
                    {d.photo_url ? (
                      <img src={d.photo_url} alt={`${d.first_name} ${d.last_name}`} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={24} className="text-[#CBD5E1]" />
                    )}
                  </div>
                  <span
                    title={av.label}
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: av.dot }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-bold text-[#1D2530] truncate">
                        {d.first_name} {d.last_name}
                      </h3>
                      {d.job_title && <p className="text-[11px] text-[#8B95A5] truncate">{d.job_title}</p>}
                      <div
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: av.bg, color: av.text }}
                      >
                        <av.Icon size={10} />
                        {av.label}
                        {d.availability_until && (
                          <span className="font-normal opacity-80">
                            · jusqu'au {new Date(d.availability_until).toLocaleDateString("fr-BE", { day: "2-digit", month: "short" })}
                          </span>
                        )}
                      </div>
                      {d.availability_message && (
                        <p className="mt-0.5 text-[10px] italic text-[#616B7C] truncate" title={d.availability_message}>
                          « {d.availability_message} »
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#8B95A5] hover:text-[#1B5BDA]"><Edit2 size={13} /></button>
                      <button onClick={() => { if (confirm("Supprimer ce délégué ?")) remove.mutate(d.id); }} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#8B95A5] hover:text-[#EF4343]"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1 text-[11px] text-[#616B7C]">
                    {d.email && <div className="flex items-center gap-1.5"><Mail size={11} />{d.email}</div>}
                    {d.phone && <div className="flex items-center gap-1.5"><Phone size={11} />{d.phone}</div>}
                    {d.booking_url && (
                      <a href={d.booking_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[#1B5BDA] hover:underline truncate">
                        <CalendarDays size={11} />Prendre rendez-vous
                      </a>
                    )}
                  </div>

                  {(d.country_codes.length > 0 || d.regions.length > 0) && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[#616B7C]">
                      <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                      <span>
                        {d.country_codes.map(c => COUNTRY_LABELS[c] || c).join(", ")}
                        {d.regions.length > 0 && ` — ${d.regions.join(", ")}`}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.target_profiles.map(p => {
                      const lbl = TARGET_PROFILES.find(tp => tp.value === p)?.label || p;
                      const isPrimary = (d.primary_target_profiles || []).includes(p);
                      return (
                        <span
                          key={p}
                          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            isPrimary
                              ? "bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]"
                              : "bg-[#1B5BDA]/10 text-[#1B5BDA]"
                          }`}
                        >
                          {isPrimary && <Star size={9} className="fill-[#F59E0B] text-[#F59E0B]" />}
                          {lbl}
                        </span>
                      );
                    })}
                    {d.languages.map(l => (
                      <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#616B7C] uppercase">
                        {l}
                      </span>
                    ))}
                  </div>

                  {!d.is_active && <div className="mt-2 text-[10px] text-[#EF4343] font-semibold">Inactif</div>}
                </div>
              </div>
            </VCard>
          ))}
        </div>
          )}
        </>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le délégué" : "Nouveau délégué"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center overflow-hidden">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={28} className="text-[#CBD5E1]" />
                )}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <VBtn small onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Upload size={13} className="mr-1" />}
                  {form.photo_url ? "Remplacer" : "Téléverser"}
                </VBtn>
                {form.photo_url && (
                  <button onClick={() => setForm(f => ({ ...f, photo_url: "" }))} className="ml-2 text-[11px] text-[#EF4343] hover:underline">
                    Retirer
                  </button>
                )}
                <p className="text-[10px] text-[#8B95A5] mt-1">JPG/PNG, 2 Mo max</p>
              </div>
            </div>

            {/* Identité */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom *">
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className={inputCls} placeholder="Laure" />
              </Field>
              <Field label="Nom *">
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className={inputCls} placeholder="Durant" />
              </Field>
            </div>
            <Field label="Fonction">
              <input value={form.job_title || ""} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} className={inputCls} placeholder="Responsable commercial pharmacies" />
            </Field>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input type="email" value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="laure@vendeur.be" />
              </Field>
              <Field label="Téléphone">
                <input value={form.phone || ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="+32 ..." />
              </Field>
            </div>
            <Field label="Lien de prise de rendez-vous (Calendly, Bookings, Zcal…)">
              <input
                type="url"
                value={form.booking_url || ""}
                onChange={e => setForm(f => ({ ...f, booking_url: e.target.value }))}
                className={inputCls}
                placeholder="https://calendly.com/laure-durant"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-[#8B95A5]">
                  URL complète. Ce bouton « Prendre rendez-vous » s'affichera sur la fiche vue par les acheteurs.
                </p>
                {form.booking_url && (
                  <a
                    href={/^https?:\/\//i.test(form.booking_url) ? form.booking_url : `https://${form.booking_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B5BDA] hover:underline"
                  >
                    <CalendarDays size={11} /> Tester le lien
                  </a>
                )}
              </div>
            </Field>

            {/* Langues */}
            <Field label="Langues parlées">
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map(l => (
                  <Chip key={l} active={form.languages.includes(l)} onClick={() => setForm(f => ({ ...f, languages: toggle(f.languages, l) }))}>
                    {LANGUAGE_LABELS[l]}
                  </Chip>
                ))}
              </div>
            </Field>

            {/* Pays + régions */}
            <Field label="Pays couverts">
              <div className="flex flex-wrap gap-1.5">
                {COUNTRIES.map(c => (
                  <Chip key={c} active={form.country_codes.includes(c)} onClick={() => setForm(f => ({ ...f, country_codes: toggle(f.country_codes, c), regions: f.regions.filter(r => REGIONS_BY_COUNTRY[c]?.includes(r) || !toggle(f.country_codes, c).every(cc => !REGIONS_BY_COUNTRY[cc]?.includes(r))) }))}>
                    {COUNTRY_LABELS[c]}
                  </Chip>
                ))}
              </div>
            </Field>
            {availableRegions.length > 0 && (
              <Field label="Régions / Zones de chalandise">
                <div className="flex flex-wrap gap-1.5">
                  {availableRegions.map(r => (
                    <Chip key={r} active={form.regions.includes(r)} onClick={() => setForm(f => ({ ...f, regions: toggle(f.regions, r) }))}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </Field>
            )}

            {/* Codes postaux */}
            <Field label="Codes postaux ciblés (optionnel)">
              <input
                value={form.postal_codes.join(", ")}
                onChange={e => setForm(f => ({ ...f, postal_codes: e.target.value.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean) }))}
                className={inputCls}
                placeholder="Ex. 1000, 1040, 8000-8999, 1180"
              />
              <p className="text-[10px] text-[#8B95A5] mt-1">
                Séparés par virgule. Plages possibles (ex. 8000-8999). Laisse vide pour cibler toute la région.
              </p>
            </Field>

            {/* Cibles */}
            <Field label="Profils d'acheteurs ciblés">
              <div className="flex flex-wrap gap-1.5">
                {TARGET_PROFILES.map(p => (
                  <Chip key={p.value} active={form.target_profiles.includes(p.value)} onClick={() => setForm(f => ({
                    ...f,
                    target_profiles: toggle(f.target_profiles, p.value),
                    // Si on désélectionne la cible, retire aussi le statut "référent"
                    primary_target_profiles: f.target_profiles.includes(p.value)
                      ? f.primary_target_profiles.filter(v => v !== p.value)
                      : f.primary_target_profiles,
                  }))}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </Field>

            {/* Référent principal */}
            {form.target_profiles.length > 0 && (
              <Field label="Référent principal pour ces segments">
                <p className="text-[10px] text-[#8B95A5] mb-1.5">
                  Ce délégué sera affiché en priorité aux acheteurs de ces segments.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {form.target_profiles.map(value => {
                    const p = TARGET_PROFILES.find(tp => tp.value === value);
                    if (!p) return null;
                    const isPrimary = form.primary_target_profiles.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, primary_target_profiles: toggle(f.primary_target_profiles, value) }))}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1 ${
                          isPrimary
                            ? "bg-[#F59E0B] text-white border-[#F59E0B]"
                            : "bg-white text-[#616B7C] border-[#E2E8F0] hover:border-[#F59E0B] hover:text-[#F59E0B]"
                        }`}
                      >
                        <Star size={10} className={isPrimary ? "fill-white" : ""} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* Bio */}
            <Field label="Bio courte (optionnel)">
              <textarea value={form.bio || ""} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={2} maxLength={280} className={inputCls} placeholder="Spécialiste depuis 10 ans en…" />
            </Field>

            {/* Statut */}
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2">
              <div>
                <div className="text-[13px] font-semibold text-[#1D2530]">Délégué actif</div>
                <div className="text-[11px] text-[#8B95A5]">Visible pour les acheteurs vérifiés</div>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>

          <DialogFooter>
            <VBtn small onClick={closeDialog}>Annuler</VBtn>
            <VBtn small primary onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.first_name || !form.last_name}>
              {upsert.isPending && <Loader2 size={13} className="mr-1 animate-spin" />}
              {editing ? "Enregistrer" : "Ajouter"}
            </VBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#1D2530] focus:outline-none focus:border-[#1B5BDA]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-[#8B95A5] mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-[#1B5BDA] text-white border-[#1B5BDA]"
          : "bg-white text-[#616B7C] border-[#E2E8F0] hover:border-[#1B5BDA] hover:text-[#1B5BDA]"
      }`}
    >
      {children}
    </button>
  );
}
