import { Facebook, Instagram, Linkedin, Youtube, Music2, Twitter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SocialKey = "facebook" | "instagram" | "linkedin" | "youtube" | "tiktok" | "x";

export const SOCIAL_DEFS: { key: SocialKey; label: string; icon: any; placeholder: string }[] = [
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/..." },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/..." },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@..." },
  { key: "tiktok", label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@..." },
  { key: "x", label: "X (Twitter)", icon: Twitter, placeholder: "https://x.com/..." },
];

export type SocialLinks = Partial<Record<SocialKey, string>>;

export function normalizeSocialLinks(input: any): SocialLinks {
  if (!input || typeof input !== "object") return {};
  const out: SocialLinks = {};
  for (const def of SOCIAL_DEFS) {
    const v = input[def.key];
    if (typeof v === "string" && v.trim()) out[def.key] = v.trim();
  }
  return out;
}

export function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SocialLinks;
  onChange: (next: SocialLinks) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">Réseaux sociaux</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SOCIAL_DEFS.map(({ key, label, icon: Icon, placeholder }) => (
          <div key={key} className="flex items-center gap-2">
            <Icon size={14} className="text-muted-foreground shrink-0" />
            <Input
              value={value[key] || ""}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              placeholder={placeholder}
              className="h-8 text-[12px]"
              aria-label={label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SocialLinksDisplay({
  links,
  className = "",
}: {
  links: SocialLinks | null | undefined;
  className?: string;
}) {
  const normalized = normalizeSocialLinks(links);
  const entries = SOCIAL_DEFS.filter((d) => normalized[d.key]);
  if (entries.length === 0) return null;
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {entries.map(({ key, label, icon: Icon }) => (
        <a
          key={key}
          href={normalized[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="w-8 h-8 rounded-md border border-mk-line flex items-center justify-center text-mk-sec hover:text-mk-blue hover:border-mk-blue transition-colors"
        >
          <Icon size={14} />
        </a>
      ))}
    </div>
  );
}
