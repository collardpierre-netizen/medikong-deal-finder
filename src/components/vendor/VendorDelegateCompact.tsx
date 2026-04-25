import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { Mail, Phone, CalendarDays, User as UserIcon, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  vendorId: string;
  /** Variante d'affichage : "card" (par défaut, encadré) ou "inline" (sans bordure) */
  variant?: "card" | "inline";
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
  languages: string[];
  country_codes: string[];
  regions: string[];
  postal_codes: string[];
  target_profiles: string[];
  primary_target_profiles: string[];
  is_active: boolean;
  display_order: number;
}

/**
 * Carte compacte "Mon délégué" : affiche UN seul délégué (le mieux matché)
 * pour un vendeur donné, filtré selon le profil + pays de l'acheteur connecté.
 * Conçue pour le panier et la fiche produit. Silencieux si pas vérifié ou aucun délégué.
 */
export default function VendorDelegateCompact({ vendorId, variant = "card" }: Props) {
  const { user, isVerifiedBuyer } = useAuth();
  const { currentCountry } = useCountry();

  const { data: customer } = useQuery({
    queryKey: ["customer-profile-for-delegate-compact", user?.id],
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

  const { data: delegates = [] } = useQuery<Delegate[]>({
    queryKey: ["vendor-delegate-compact", vendorId],
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
    enabled: isVerifiedBuyer && !!vendorId,
  });

  if (!isVerifiedBuyer || delegates.length === 0) return null;

  const buyerProfile = customer?.customer_type || null;
  const buyerCountry = customer?.country_code || currentCountry?.code || null;

  const score = (d: Delegate) => {
    let s = 0;
    if (buyerProfile && (d.primary_target_profiles || []).includes(buyerProfile)) s += 50;
    if (buyerProfile && d.target_profiles.includes(buyerProfile)) s += 10;
    if (buyerCountry && d.country_codes.includes(buyerCountry)) s += 5;
    if (d.target_profiles.length === 0) s += 1;
    if (d.country_codes.length === 0) s += 1;
    return s;
  };

  const ranked = [...delegates].sort((a, b) => score(b) - score(a));
  const d = ranked[0];
  const isPrimary = !!buyerProfile && (d.primary_target_profiles || []).includes(buyerProfile);

  const containerClass =
    variant === "card"
      ? "rounded-lg border border-border bg-accent/30 p-3"
      : "p-2";

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isPrimary ? "★ Votre référent dédié" : "Votre contact"}
        </span>
      </div>
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
          {d.photo_url ? (
            <img
              src={d.photo_url}
              alt={`${d.first_name} ${d.last_name}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserIcon size={16} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            to={`/delegue/${d.id}`}
            className="text-xs font-semibold text-foreground hover:text-primary truncate inline-flex items-center gap-1"
          >
            {d.first_name} {d.last_name}
            <ExternalLink size={10} className="opacity-60" />
          </Link>
          {d.job_title && (
            <div className="text-[10px] text-muted-foreground truncate">{d.job_title}</div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {d.email && (
              <a
                href={`mailto:${d.email}`}
                className="inline-flex items-center gap-1 text-foreground hover:text-primary"
              >
                <Mail size={11} />
                <span className="truncate max-w-[140px]">{d.email}</span>
              </a>
            )}
            {d.phone && (
              <a
                href={`tel:${d.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1 text-foreground hover:text-primary"
              >
                <Phone size={11} />
                <span>{d.phone}</span>
              </a>
            )}
            {d.booking_url && (
              <a
                href={d.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90 text-[10px] font-semibold"
              >
                <CalendarDays size={10} />
                Prendre RDV
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
