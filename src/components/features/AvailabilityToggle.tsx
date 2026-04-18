import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AvailabilityToggleProps {
  userId: string;
}

export function AvailabilityToggle({ userId }: AvailabilityToggleProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("delivery_agents")
      .select("is_online")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        setIsOnline(data?.is_online ?? false);
        setLoading(false);
      });
  }, [userId]);

    const toggle = async () => {
    setSaving(true);
    const newStatus = !isOnline;
    const { error } = await supabase
      .from("delivery_agents")
      .update({ 
        is_online: newStatus, 
        status: newStatus ? 'online' : 'offline',
        updated_at: new Date().toISOString() 
      })
      .eq("user_id", userId);

    if (!error) setIsOnline(newStatus);
    setSaving(false);
  };

  if (loading) return null;

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95
        ${isOnline
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : "bg-secondary text-muted-foreground border border-border"
        }
        disabled:opacity-50
      `}
    >
      <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`} />
      {saving ? "Updating..." : isOnline ? "Online — Taking Orders" : "Offline"}
    </button>
  );
}
