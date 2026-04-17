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

    // Safety timeout — forces setLoading(false) after 5 s if INITIAL_SESSION never fires
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn("Agent: INITIAL_SESSION never fired — forcing loading=false");
        setAuthError("Session check timed out. Please refresh.");
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        console.log(`🔐 Agent Auth Event [${event}]`);

        if (event === "INITIAL_SESSION") {
          // Clear the safety timer — we got a real response
          clearTimeout(safetyTimer);

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

          // setLoading(false) ONLY here — on INITIAL_SESSION
          if (mounted) setLoading(false);

        } else if (event === "SIGNED_IN") {
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
          }

        } else if (event === "SIGNED_OUT") {
          if (mounted) {
            setSession(null);
            setUser(null);
            setIsAgent(false);
            setAgent(null);
          }

        } else if (event === "TOKEN_REFRESHED") {
          if (mounted) setSession(currentSession);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
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
    await supabase.auth.signOut();
    setAgent(null);
    setIsAgent(false);
    setUser(null);
    setSession(null);
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
