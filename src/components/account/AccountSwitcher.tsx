import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount, type AccountKind } from "@/contexts/ActiveAccountContext";
import { Building2, Store, ShieldCheck, ChevronDown, Check, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function iconFor(kind: AccountKind, size = 14) {
  if (kind === "vendor") return <Store size={size} />;
  if (kind === "admin") return <ShieldCheck size={size} />;
  return <Building2 size={size} />;
}
function landingFor(kind: AccountKind): string {
  if (kind === "vendor") return "/vendor";
  if (kind === "admin") return "/admin";
  return "/mon-compte";
}

interface AccountSwitcherProps {
  compact?: boolean;
  className?: string;
}

/**
 * Chip visible dans les topbars ; menu déroulant listant tous les comptes
 * (buyer/vendor/admin) rattachés à l'utilisateur courant.
 */
export function AccountSwitcher({ compact = false, className = "" }: AccountSwitcherProps) {
  const { accounts, activeKind, activeId, setActive, loading } = useActiveAccount();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  if (loading || accounts.length <= 1) return null;

  const current = accounts.find(a => a.kind === activeKind && a.account_id === activeId);
  const label = current?.display_name ?? "Choisir un compte";

  const handleSwitch = async (kind: AccountKind, id: string) => {
    try {
      setSwitching(true);
      await setActive(kind, id);
      navigate(landingFor(kind));
      // Force fresh data everywhere
      setTimeout(() => window.location.reload(), 50);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-slate-50 ${className}`}
          style={{ borderColor: "#E2E8F0", color: "#1D2530", backgroundColor: "#FFF" }}
        >
          {current ? iconFor(current.kind) : <RefreshCw size={14} />}
          {!compact && <span className="truncate max-w-[160px]">{label}</span>}
          <ChevronDown size={12} style={{ color: "#8B95A5" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-500">
          Changer de compte
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map(a => {
          const active = a.kind === activeKind && a.account_id === activeId;
          return (
            <DropdownMenuItem
              key={`${a.kind}:${a.account_id}`}
              onClick={() => !active && handleSwitch(a.kind, a.account_id)}
              disabled={switching}
              className="flex items-start gap-2 py-2 cursor-pointer"
            >
              <div className="mt-0.5 shrink-0" style={{ color: "#1B5BDA" }}>{iconFor(a.kind, 16)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.display_name}</div>
                <div className="text-[11px] text-slate-500">
                  {a.kind === "buyer" ? "Acheteur" : a.kind === "vendor" ? "Vendeur" : "Admin"}
                  {" · "}{a.role}
                </div>
              </div>
              {active && <Check size={14} className="mt-1 shrink-0" style={{ color: "#1B5BDA" }} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
