import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { Mail, Phone, CalendarDays, MapPin, User as UserIcon, Lock } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  vendorId: string;
}

interface Delegate {
  id: string;
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
}

export default function VendorDelegatesPublic({ vendorId }: Props) {
  const { user, isVerifiedBuyer } = useAuth();
  const { currentCountry } = useCountry();

  // Récupère le profil acheteur (customer_type) pour filtrer
  const { data: customer } = useQuery({
    queryKey: ["customer-profile-for-delegates", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("customers")
        .select("customer_type, country_code")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && isVerifiedBuyer,
  });

  const { data: delegates = [], isLoading } = useQuery<Delegate[]>({
    queryKey: ["vendor-delegates-public", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_delegates" as any)
        .select("*")
        .eq("vendor_id", vendorId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Delegate[];
    },
    enabled: isVerifiedBuyer,
  });

  // Si pas vérifié → CTA discret
  if (!isVerifiedBuyer) {
    return (
      <div className="rounded-xl border border-border bg-accent/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={14} className="text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Votre délégué commercial
          </h4>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Connectez-vous en tant qu'acheteur vérifié pour contacter votre délégué dédié.
        </p>
        <Link
          to={user ? "/compte" : "/connexion"}
          className="text-xs font-semibold text-primary hover:underline"
        >
          {user ? "Faire vérifier mon compte →" : "Se connecter →"}
        </Link>
      </div>
    );
  }

  if (isLoading || delegates.length === 0) return null;

  // Filtrage : on tente match profil + pays, sinon on retombe sur tous
  const buyerProfile = customer?.customer_type || null;
  const buyerCountry = customer?.country_code || currentCountry?.code || null;

  const score = (d: Delegate) => {
    let s = 0;
    // Référent principal pour le segment de l'acheteur = priorité maximale
    if (buyerProfile && (d.primary_target_profiles || []).includes(buyerProfile)) s += 50;
    if (buyerProfile && d.target_profiles.includes(buyerProfile)) s += 10;
    if (buyerCountry && d.country_codes.includes(buyerCountry)) s += 5;
    if (d.target_profiles.length === 0) s += 1; // generic
    if (d.country_codes.length === 0) s += 1;
    return s;
  };

  const ranked = [...delegates].sort((a, b) => score(b) - score(a));
  // On garde le meilleur match + jusqu'à 2 autres pertinents
  const top = ranked.slice(0, 3);

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {top.length === 1 ? "Votre délégué" : "Vos contacts"}
      </h4>
      <div className="space-y-4">
        {top.map((d) => (
          <div key={d.id} className="flex gap-3">
            <div className="w-12 h-12 rounded-full bg-accent border border-border flex items-center justify-center overflow-hidden shrink-0">
              {d.photo_url ? (
                <img src={d.photo_url} alt={`${d.first_name} ${d.last_name}`} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={20} className="text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {d.first_name} {d.last_name}
              </div>
              {d.job_title && (
                <div className="text-[11px] text-muted-foreground truncate">{d.job_title}</div>
              )}

              {d.bio && (
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{d.bio}</p>
              )}

              <div className="mt-2 space-y-1 text-[11px]">
                {d.email && (
                  <a href={`mailto:${d.email}`} className="flex items-center gap-1.5 text-foreground hover:text-primary">
                    <Mail size={11} className="shrink-0" />
                    <span className="truncate">{d.email}</span>
                  </a>
                )}
                {d.phone && (
                  <a href={`tel:${d.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-foreground hover:text-primary">
                    <Phone size={11} className="shrink-0" />
                    <span>{d.phone}</span>
                  </a>
                )}
                {d.booking_url && (
                  <a
                    href={d.booking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-[11px] font-semibold"
                  >
                    <CalendarDays size={11} />
                    Prendre RDV
                  </a>
                )}
              </div>

              {(d.regions.length > 0 || d.languages.length > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {d.regions.slice(0, 2).map((r) => (
                    <span key={r} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                      <MapPin size={9} />
                      {r}
                    </span>
                  ))}
                  {d.languages.map((l) => (
                    <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground uppercase">
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
