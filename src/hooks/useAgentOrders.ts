import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AgentOrder {
  id: string;
  order_code?: string;
  status: string;
  pickup_address?: string;
  delivery_address?: string;
  total_amount?: number;
  total_fee?: number;
  customer_name?: string;
  distance_km?: number;
  delivery_fee?: number;
  created_at: string;
  agent_id?: string;
}

/**
 * Real-time hook for agent's active and recent orders.
 * Subscribes to Supabase realtime for live updates.
 */
export function useAgentOrders(agentId: string | undefined) {
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    // Initial fetch
    supabase
      .from("delivery_orders" as any)
      .select("*")
      .eq("agent_id", agentId)
      .in("status", ["assigned", "accepted", "picked_up", "in_transit"])
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders((data || []) as AgentOrder[]);
        setLoading(false);
      });

    // Realtime subscription
    const channel = supabase
      .channel(`agent-orders-${agentId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "delivery_orders",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setOrders((prev) => [payload.new as AgentOrder, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === payload.new.id ? (payload.new as AgentOrder) : o
              )
            );
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  return { orders, loading };
}
