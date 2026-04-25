import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Phone, CalendarDays, MapPin, User as UserIcon, ExternalLink, Globe, Languages } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  vendorId: string;
  /** Si fourni : afficher ce délégué précis. Sinon on choisit le mieux scoré. */
  delegateId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

/**
 * Popup détaillée d'UN délégué pour un vendeur donné.
 * Réutilisable depuis le QuickView produit ou la fiche vendeur publique
 * via un bouton "Voir délégué".
 */
export default function VendorDelegateDetailDialog({
  vendorId,
  delegateId,
  open,
  onOpenChange,
}: Props) {
  const { user, isVerifiedBuyer } = useAuth();
  const { currentCountry } = useCountry();

  const { data: customer } = useQuery({
    queryKey: ["customer-profile-for-delegate-detail", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("customers")
        .select("customer_type, country_code")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && isVerifiedBuyer && open,
  });

  const { data: delegates = [], isLoading } = useQuery<Delegate[]>({
    queryKey: ["vendor-delegates-detail", vendorId],
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
    enabled: open && !!vendorId,
  });

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
  const d = delegateId
    ? delegates.find((x) => x.id === delegateId) ?? ranked[0]
    : ranked[0];

  const isPrimary =
    !!d && !!buyerProfile && (d.primary_target_profiles || []).includes(buyerProfile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isPrimary ? "★ Votre référent dédié" : "Votre contact commercial"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : !d ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Aucun délégué disponible pour ce vendeur.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 rounded-full bg-accent border border-border flex items-center justify-center overflow-hidden shrink-0">
                {d.photo_url ? (
                  <img
                    src={d.photo_url}
                    alt={`${d.first_name} ${d.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon size={26} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground">
                  {d.first_name} {d.last_name}
                </h3>
                {d.job_title && (
                  <p className="text-xs text-muted-foreground">{d.job_title}</p>
                )}
                {isPrimary && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    ★ Référent de votre profil
                  </span>
                )}
              </div>
            </div>

            {d.bio && (
              <p className="text-[13px] text-muted-foreground leading-relaxed">{d.bio}</p>
            )}

            <div className="space-y-2 text-sm">
              {d.email && (
                <a
                  href={`mailto:${d.email}`}
                  className="flex items-center gap-2 text-foreground hover:text-primary"
                >
                  <Mail size={14} className="shrink-0" />
                  <span className="truncate">{d.email}</span>
                </a>
              )}
              {d.phone && (
                <a
                  href={`tel:${d.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 text-foreground hover:text-primary"
                >
                  <Phone size={14} className="shrink-0" />
                  <span>{d.phone}</span>
                </a>
              )}
            </div>

            {(d.regions.length > 0 || d.country_codes.length > 0) && (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Zone de chalandise
                </h4>
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.country_codes.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-accent text-muted-foreground"
                    >
                      <Globe size={10} />
                      {c.toUpperCase()}
                    </span>
                  ))}
                  {d.regions.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-accent text-muted-foreground"
                    >
                      <MapPin size={10} />
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {d.languages.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Langues
                </h4>
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.languages.map((l) => (
                    <span
                      key={l}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-accent text-muted-foreground uppercase"
                    >
                      <Languages size={10} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {d.target_profiles.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Cibles
                </h4>
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.target_profiles.map((p) => (
                    <span
                      key={p}
                      className={`text-[11px] px-2 py-0.5 rounded ${
                        (d.primary_target_profiles || []).includes(p)
                          ? "bg-amber-100 text-amber-800 border border-amber-300 font-semibold"
                          : "bg-accent text-muted-foreground"
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              {d.booking_url && (
                <a
                  href={d.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold"
                >
                  <CalendarDays size={12} />
                  Prendre rendez-vous
                </a>
              )}
              <Link
                to={`/delegue/${d.id}`}
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold text-foreground hover:bg-accent"
              >
                Fiche complète
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
