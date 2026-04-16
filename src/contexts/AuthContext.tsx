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
    let isMounted = true;
    let authTimeout: NodeJS.Timeout;
    const initialized = { current: false };

    const handleAuthChange = async (currentSession: Session | null, source: string) => {
      // Prevent multiple parallel initializations on first load
      if (source === "INITIAL" && initialized.current) return;
      if (source === "INITIAL") initialized.current = true;

      try {
        console.group(`🔐 Agent Auth Sync [${source}]`);
        console.log("Session exists:", !!currentSession);
        
        if (authTimeout) clearTimeout(authTimeout);
        if (!isMounted) return;

        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          console.log("Checking agent role for:", currentUser.email);
          const hasAgentRole = await checkAgentRole(currentUser.id, currentUser.email);
          
          if (isMounted) {
            setIsAgent(hasAgentRole);
            if (hasAgentRole) {
              const profile = await fetchAgentProfile(currentUser.id);
              if (isMounted) setAgent(profile);
            } else {
              setAgent(null);
            }
          }
        } else {
          setIsAgent(false);
          setAgent(null);
        }
      } catch (error) {
        console.error("Auth sync failed in Agent:", error);
        if (isMounted) {
          setAuthError("Failed to initialize agent session.");
        }
      } finally {
        if (isMounted) setLoading(false);
        console.groupEnd();
      }
    };

    // Safety timeout
    authTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("⚠️ Auth initialization timeout reached in Agent Dashboard");
        setAuthError("Synchronization is taking longer than expected.");
        setLoading(false);
      }
    }, 8000);

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) handleAuthChange(session, "SESSION_GET");
    }).catch(err => {
      console.error("Initial session fetch error Agent:", err);
      if (isMounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (isMounted) await handleAuthChange(session, event);
      }
    );

    return () => {
      isMounted = false;
      if (authTimeout) clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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
