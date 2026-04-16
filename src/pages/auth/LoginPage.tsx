import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function LoginPage() {
  const { signInWithGoogle, loading, user, isAgent } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && isAgent) {
      navigate("/agent/dashboard");
    }
  }, [user, isAgent, navigate]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm space-y-10 relative">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-3xl bg-primary/15 border border-primary/20 flex items-center justify-center mx-auto">
            <Truck className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Deliver<span className="text-primary">Pro</span>
            </h1>
            <p className="text-muted-foreground mt-1">Agent delivery portal</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <span className="text-destructive text-lg shrink-0">⚠️</span>
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Sign-in Card */}
        <div className="glass rounded-2xl border border-border p-8 space-y-5">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Sign in to start deliveries</p>
            <p className="text-xs text-muted-foreground">Use the Gmail account assigned by your admin</p>
          </div>

          {/* Google Button */}
          <button
            id="agent-google-signin-btn"
            onClick={signInWithGoogle}
            className="w-full h-14 rounded-xl bg-white text-gray-800 font-semibold text-sm hover:bg-gray-50 active:scale-[0.97] transition-all flex items-center justify-center gap-3 shadow-md border border-gray-200"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">access restricted</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            Only Gmail accounts approved by your admin can sign in.
            <br />
            <span className="text-primary">Contact your admin</span> if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
