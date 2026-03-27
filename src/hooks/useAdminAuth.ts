import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminRole = "super_admin" | "admin" | "moderateur" | "support" | "comptable";

interface AdminAuthState {
  isAdmin: boolean;
  role: AdminRole | null;
  adminName: string | null;
  loading: boolean;
}

export function useAdminAuth(): AdminAuthState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: false,
    role: null,
    adminName: null,
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ isAdmin: false, role: null, adminName: null, loading: false });
      return;
    }

    const check = async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("role, name, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setState({ isAdmin: false, role: null, adminName: null, loading: false });
      } else {
        setState({
          isAdmin: true,
          role: data.role as AdminRole,
          adminName: data.name,
          loading: false,
        });
      }
    };
    check();
  }, [user, authLoading]);

  return state;
}
