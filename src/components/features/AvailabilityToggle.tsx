import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAgentAvailability } from "@/hooks/useAgentAvailability";

interface AvailabilityToggleProps {
  userId: string;
}

export function AvailabilityToggle({ userId }: AvailabilityToggleProps) {
  const { status, changeStatus, loading } = useAgentAvailability();
  const [saving, setSaving] = useState(false);
  const isOnline = status !== "offline";

  const toggle = async () => {
    if (!userId) return;
    const nextStatus = isOnline ? "offline" : "online";

    try {
      setSaving(true);
      await changeStatus(nextStatus);
      toast.success(nextStatus === "online" ? "You are online" : "You are offline");
    } catch (error: any) {
      toast.error(error.message || "Failed to update availability");
    } finally {
      setSaving(false);
    }
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
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isOnline ? "Online - Taking Orders" : "Offline"}
    </button>
  );
}
