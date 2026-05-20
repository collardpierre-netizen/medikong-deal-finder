import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { Mail, Phone, CalendarDays, MapPin, User as UserIcon, Lock, Star } from "lucide-react";
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

  const isReferent = (d: Delegate) =>
    !!buyerProfile && (d.primary_target_profiles || []).includes(buyerProfile);

  const renderCard = (d: Delegate, showHeaderLabel: boolean) => (
    <div
      key={d.id}
      className="bg-card border border-border rounded-2xl shadow-sm p-5 space-y-4"
    >
      {/* Header : label + badge référent */}
      <div className="flex justify-between items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {showHeaderLabel ? "Votre délégué" : "Délégué"}
        </span>
        {isReferent(d) && (
          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-bold">
            <Star size={10} className="fill-current" />
            Votre référent
          </span>
        )}
      </div>

      {/* Profil : avatar + nom + poste + lien fiche */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-full bg-accent border border-border flex items-center justify-center overflow-hidden">
            {d.photo_url ? (
              <img
                src={d.photo_url}
                alt={`${d.first_name} ${d.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon size={28} className="text-muted-foreground" />
            )}
          </div>
          {d.is_active && (
            <span
              aria-hidden
              className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-card rounded-full"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to={`/delegue/${d.id}`}
            className="text-base font-bold text-foreground leading-tight hover:text-primary block truncate"
          >
            {d.first_name} {d.last_name}
          </Link>
          {d.job_title && (
            <p className="text-sm text-muted-foreground truncate">{d.job_title}</p>
          )}
          <Link
            to={`/delegue/${d.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Voir le profil complet
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      {/* Contacts discrets */}
      {(d.email || d.phone) && (
        <div className="grid grid-cols-2 gap-2">
          {d.email && (
            <a
              href={`mailto:${d.email}`}
              className="group flex items-center gap-2 px-3 py-2 bg-muted/60 hover:bg-muted rounded-lg transition-colors min-w-0"
              title={d.email}
            >
              <Mail size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />
              <span className="text-xs text-foreground truncate">Email</span>
            </a>
          )}
          {d.phone && (
            <a
              href={`tel:${d.phone.replace(/\s/g, "")}`}
              className="group flex items-center gap-2 px-3 py-2 bg-muted/60 hover:bg-muted rounded-lg transition-colors min-w-0"
              title={d.phone}
            >
              <Phone size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />
              <span className="text-xs text-foreground truncate">Téléphone</span>
            </a>
          )}
        </div>
      )}

      {/* CTA principal */}
      {d.booking_url && (
        <a
          href={d.booking_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-3 rounded-xl shadow-sm transition-all active:scale-[0.98]"
        >
          <CalendarDays size={16} />
          Prendre rendez-vous
        </a>
      )}

      {/* Footer : langues + régions */}
      {(d.languages.length > 0 || d.regions.length > 0) && (
        <div className="pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {d.languages.map((l) => (
              <span
                key={l}
                className="px-2 py-0.5 bg-muted text-[10px] font-bold text-muted-foreground rounded uppercase"
              >
                {l}
              </span>
            ))}
          </div>
          {d.regions.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin size={10} />
              {d.regions.slice(0, 2).join(" · ")}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {top.map((d, i) => renderCard(d, i === 0))}
    </div>
  );
}
