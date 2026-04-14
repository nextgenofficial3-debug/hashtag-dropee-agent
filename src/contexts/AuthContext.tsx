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

  const fetchAgentProfile = async (userId: string) => {
    const { data } = await supabase
      .from("delivery_agents")
      .select("*")
      .eq("user_id", userId)
      .single();
    setAgent(data as AgentProfile | null);
  };

  const checkAgentRole = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "agent")
      .maybeSingle();
    return !!data;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const agentRole = await checkAgentRole(session.user.id);
          setIsAgent(agentRole);
          if (agentRole) {
            setTimeout(() => fetchAgentProfile(session.user!.id), 0);
          } else {
            setAgent(null);
          }
        } else {
          setIsAgent(false);
          setAgent(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const agentRole = await checkAgentRole(session.user.id);
        setIsAgent(agentRole);
        if (agentRole) {
          fetchAgentProfile(session.user.id);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAgent(null);
    setIsAgent(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, agent, loading, isAgent, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
