import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { checkIsAdminUser, fetchAdminProfile } from "@/lib/admin-access";

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

    let cancelled = false;

    const check = async () => {
      try {
        const isAdmin = await checkIsAdminUser(user.id);

        if (!isAdmin) {
          if (!cancelled) {
            setState({ isAdmin: false, role: null, adminName: null, loading: false });
          }
          return;
        }

        let role: AdminRole | null = null;
        let adminName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null;

        try {
          const profile = await fetchAdminProfile(user.id);
          role = (profile.role as AdminRole | null) ?? null;
          adminName = profile.name ?? adminName;
        } catch {
          // Keep admin access even if profile details are temporarily unavailable.
        }

        if (!cancelled) {
          setState({
            isAdmin: true,
            role,
            adminName,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ isAdmin: false, role: null, adminName: null, loading: false });
        }
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
