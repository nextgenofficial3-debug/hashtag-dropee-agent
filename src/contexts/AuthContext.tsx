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
  refreshAgent: () => Promise<AgentProfile | null>;
  signUp: (email: string, password: string, fullName: string, agentCode: string) => Promise<{ error: Error | null }>;
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

  const buildDefaultAgentCode = (currentUser: User) => {
    const metadataCode = currentUser.user_metadata?.agent_code;
    if (typeof metadataCode === "string" && metadataCode.trim()) {
      return metadataCode.trim().toUpperCase();
    }
    return `AG-${currentUser.id.slice(0, 8).toUpperCase()}`;
  };

  const fetchAgentProfile = async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from("delivery_agents")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching agent profile:", error);
        return null;
      }

      if (data) return data as AgentProfile;

      const fallbackProfile = {
        user_id: currentUser.id,
        agent_code: buildDefaultAgentCode(currentUser),
        full_name:
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          currentUser.email?.split("@")[0] ||
          "Delivery Agent",
        email: currentUser.email ?? null,
        phone: currentUser.phone ?? currentUser.user_metadata?.phone ?? null,
        vehicle: "bike",
      };

      const { data: created, error: createError } = await supabase
        .from("delivery_agents")
        .insert(fallbackProfile)
        .select("*")
        .single();

      if (createError) {
        console.error("Error creating agent profile:", createError);
        setAuthError(`Agent profile missing and could not be created: ${createError.message}`);
        return null;
      }

      return created as AgentProfile;
    } catch (err) {
      console.error("Exception in fetchAgentProfile:", err);
      return null;
    }
  };

  const refreshAgent = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setAgent(null);
      return null;
    }
    const profile = await fetchAgentProfile(data.user);
    setAgent(profile);
    return profile;
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
                const profile = await fetchAgentProfile(currentUser);
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

  const signUp = async (email: string, password: string, fullName: string, agentCode: string) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            agent_code: agentCode,
          },
        },
      });

      if (error) return { error };

      if (data.user) {
        await supabase.from("delivery_agents").insert({
          user_id: data.user.id,
          agent_code: agentCode.trim().toUpperCase(),
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          vehicle: "bike",
        });

        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "agent",
        });
      }

      return { error: null };
    } catch (error: any) {
      return { error };
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
    <AuthContext.Provider value={{ user, session, agent, loading, isAgent, authError, refreshAgent, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
