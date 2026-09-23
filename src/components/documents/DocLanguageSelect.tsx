import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOC_LANGUAGES, DOC_LANGUAGE_LABELS, type DocLang } from "@/lib/doc-i18n";

interface Props {
  value: DocLang;
  onChange: (lang: DocLang) => void;
  /** Libellé court affiché avant le sélecteur. */
  label?: string;
  className?: string;
}

/** Sélecteur de langue pour les documents imprimables (devis, BC, BL, facture). */
export default function DocLanguageSelect({ value, onChange, label = "Langue du document", className }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as DocLang)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DOC_LANGUAGES.map((l) => (
            <SelectItem key={l} value={l}>
              {DOC_LANGUAGE_LABELS[l]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
