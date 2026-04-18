import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AgentProfile {
  id: string;
  agent_code: string;
  full_name: string;
  user_id: string;
  vehicle: string;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  total_deliveries: number;
  total_earnings: number;
  average_rating: number;
  is_verified: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  agent: AgentProfile | null;
  loading: boolean;
  isAgent: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [isAgent, setIsAgent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchAgentProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching agent profile:", error);
        return null;
      }
      return data as AgentProfile;
    } catch (err) {
      console.error("Exception in fetchAgentProfile:", err);
      return null;
    }
  };

  const checkAgentRole = async (userId: string, email?: string): Promise<boolean> => {
    // Super admin always has access
    if (email?.toLowerCase() === "hashtagdropee@gmail.com") return true;

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["agent", "admin", "super_admin"])
        .maybeSingle();

      if (error) {
        console.error("Error checking agent role:", error);
        return false;
      }
      return !!data;
    } catch (err) {
      console.error("Exception in checkAgentRole:", err);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          setSession(currentSession);
          const currentUser = currentSession?.user ?? null;
          setUser(currentUser);

          if (currentUser && mounted) {
            const hasAgentRole = await checkAgentRole(currentUser.id, currentUser.email ?? undefined);
            if (mounted) {
              setIsAgent(hasAgentRole);
              if (hasAgentRole) {
                const profile = await fetchAgentProfile(currentUser.id);
                if (mounted) setAgent(profile);
              } else {
                setAgent(null);
              }
            }
          } else {
            setIsAgent(false);
            setAgent(null);
          }

          // Clear stale cache on sign in
          if (event === 'SIGNED_IN' && 'caches' in window) {
            caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
          }
          if (mounted) setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsAgent(false);
          setAgent(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
        }
      }
    );

    // Hard fallback — never spin forever
    const fallback = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setAuthError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google sign-in error Agent:", err);
      setAuthError(err.message || "Failed to start Google sign-in");
    }
  };

  const signOut = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      await supabase.auth.signOut();
    } finally {
      window.location.href = '/login'; // hard redirect always
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, agent, loading, isAgent, authError, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
