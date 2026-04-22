import { useState, useEffect } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { VendorSidebar } from "./VendorSidebar";
import { VendorTopBar } from "./VendorTopBar";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useImpersonation } from "@/contexts/impersonation";
import { useAuth } from "@/contexts/AuthContext";
import { ContractSignatureBanner } from "./ContractSignatureBanner";

export default function VendorLayout() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const { state: impState } = useImpersonation();
  const { user, loading } = useAuth();
  const impersonationVendorIdFromUrl = searchParams.get("impersonation_vendor_id");

  useEffect(() => {
    if (loading) {
      setChecking(true);
      return;
    }

    const check = async () => {
      if (
        (impState.isImpersonating && impState.session?.target_type === "vendor" && impState.session?.target_vendor_id) ||
        impersonationVendorIdFromUrl
      ) {
        setChecking(false);
        return;
      }

      if (!user) {
        navigate("/vendor/login", { replace: true });
        return;
      }

      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (adminUser) {
        setChecking(false);
        return;
      }

      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!vendor) {
        navigate("/vendor/login", { replace: true });
        return;
      }

      setChecking(false);
    };

    void check();
  }, [
    loading,
    user,
    navigate,
    impState.isImpersonating,
    impState.session?.target_type,
    impState.session?.target_vendor_id,
    impersonationVendorIdFromUrl,
  ]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "#F1F5F9" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1B5BDA" }} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: "#F1F5F9" }}>
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={isMobile ? `fixed inset-y-0 left-0 z-50 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}` : ""}>
        <VendorSidebar onNavigate={isMobile ? () => setSidebarOpen(false) : undefined} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <VendorTopBar onMenuClick={isMobile ? () => setSidebarOpen((v) => !v) : undefined} />
        <ContractSignatureBanner />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="anim-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
