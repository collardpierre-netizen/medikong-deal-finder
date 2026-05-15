import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserCheck } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/impersonation";

interface BuyerOption {
  id: string;
  auth_user_id: string;
  email: string;
  company_name: string;
}

export default function ImpersonateBuyerCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { startImpersonation, isImpersonating } = useImpersonation();
  const navigate = useNavigate();

  // Cmd+K opens the dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search buyers by company / email
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const q = supabase
        .from("customers")
        .select("id, auth_user_id, email, company_name")
        .not("auth_user_id", "is", null)
        .order("company_name")
        .limit(15);
      const { data } = query.trim()
        ? await q.or(`company_name.ilike.%${query}%,email.ilike.%${query}%`)
        : await q;
      if (cancelled) return;
      setBuyers(
        (data ?? []).filter((d) => d.auth_user_id) as BuyerOption[],
      );
      setLoading(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open]);

  if (isImpersonating) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] hover:bg-accent/40 transition-colors"
        style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
        title="Se connecter en tant qu'un acheteur (⌘K)"
      >
        <Search size={14} style={{ color: "#8B95A5" }} />
        <span style={{ color: "#8B95A5" }}>Se connecter en tant que…</span>
        <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Rechercher un acheteur par nom ou email…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Chargement…</div>
          )}
          {!loading && buyers.length === 0 && (
            <CommandEmpty>Aucun acheteur trouvé.</CommandEmpty>
          )}
          <CommandGroup heading="Acheteurs">
            {buyers.map((b) => (
              <CommandItem
                key={b.id}
                value={`${b.company_name} ${b.email}`}
                onSelect={async () => {
                  setOpen(false);
                  await startImpersonation(
                    b.auth_user_id,
                    b.email,
                    "buyer",
                    b.company_name,
                  );
                  navigate("/");
                }}
                className="flex items-center gap-3"
              >
                <UserCheck size={14} className="text-muted-foreground" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{b.company_name}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{b.email}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
