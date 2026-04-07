import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Whether the buyer account has been validated by admin */
  isVerifiedBuyer: boolean;
  /** Whether the vendor account has been validated by admin */
  isVerifiedVendor: boolean;
  /** Whether account verification status is still loading */
  verificationLoading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user?: User | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifiedBuyer, setIsVerifiedBuyer] = useState(false);
  const [isVerifiedVendor, setIsVerifiedVendor] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(true);

  // Fetch verification status when user changes
  useEffect(() => {
    if (!user) {
      setIsVerifiedBuyer(false);
      setIsVerifiedVendor(false);
      setVerificationLoading(false);
      return;
    }

    let cancelled = false;
    setVerificationLoading(true);

    const fetchVerification = async () => {
      try {
        // Check buyer (customer) verification
        const { data: customer } = await supabase
          .from("customers")
          .select("is_verified")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        // Check vendor verification
        const { data: vendor } = await supabase
          .from("vendors")
          .select("is_verified, validation_status")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!cancelled) {
          setIsVerifiedBuyer(customer?.is_verified ?? false);
          setIsVerifiedVendor(
            vendor?.is_verified === true && vendor?.validation_status === "approved"
          );
          setVerificationLoading(false);
        }
      } catch {
        if (!cancelled) {
          setVerificationLoading(false);
        }
      }
    };

    fetchVerification();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata?: Record<string, string>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      setSession(data.session ?? null);
      setUser(data.user ?? data.session?.user ?? null);
      setLoading(false);
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsVerifiedBuyer(false);
    setIsVerifiedVendor(false);
    setVerificationLoading(false);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      isVerifiedBuyer, isVerifiedVendor, verificationLoading,
      signUp, signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
