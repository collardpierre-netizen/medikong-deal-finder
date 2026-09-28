import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, History, LogOut, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useScanCustomer } from "./ScanGate";

/** Onglet « Moi » minimal : officine, e-mail, liens utiles, déconnexion, version. */
export default function ScanMePage() {
  const customer = useScanCustomer();
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const row = (to: string, label: string, Icon: typeof History) => (
    <Link to={to} className="scan-tap flex min-h-12 items-center gap-3 px-4 py-3">
      <Icon className="h-5 w-5 text-scan-emerald" />
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
  return (
    <div className="space-y-6 px-5 pt-6 pb-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold break-words">{customer.company_name ?? "Votre officine"}</h1>
        <p className="text-sm text-muted-foreground break-all">{user?.email}</p>
      </header>
      <nav className="divide-y rounded-xl border bg-card">
        {row("/conditions", "Mes conditions", SlidersHorizontal)}
        {row("/historique", "Mes derniers scans", History)}
      </nav>
      <Button variant="outline" className="scan-tap h-12 w-full text-base"
        onClick={async () => { await signOut(); nav("/", { replace: true }); }}>
        <LogOut className="mr-2 h-5 w-5" /> Se déconnecter
      </Button>
      <p className="text-center text-xs text-muted-foreground">MediKong Scan · version {__BUILD_ID__}</p>
    </div>
  );
}
