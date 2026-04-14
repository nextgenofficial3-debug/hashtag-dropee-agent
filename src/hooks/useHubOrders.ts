import { useState, useEffect, useCallback } from "react";
import { mapOrderRow, HubOrder } from "@/services/hubService";
import { updateOrderStatus } from "@/services/hubService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that subscribes to the shared MFC `orders` table for orders assigned
 * to this agent. Provides real-time updates via Supabase Postgres changes.
 */
export function useHubOrders() {
  const { agent } = useAuth();
  const [orders, setOrders] = useState<HubOrder[]>([]);

  const fetchOrders = useCallback(async () => {
    if (!agent) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("agent_user_id", agent.user_id)
      .order("created_at", { ascending: false });
    if (data) setOrders(data.map(mapOrderRow));
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    fetchOrders();

    // Real-time: react to any change on orders assigned to this agent
    const channel = supabase
      .channel(`agent-orders-${agent.user_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `agent_user_id=eq.${agent.user_id}`,
        },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agent, fetchOrders]);

  const updateStatus = useCallback(
    async (orderId: string, status: string, cancelReason?: string) => {
      return updateOrderStatus(orderId, status, agent?.user_id, cancelReason);
    },
    [agent]
  );

  // hubConnected is always true — we use Supabase Realtime natively
  return { orders, hubConnected: true, updateStatus };
}
