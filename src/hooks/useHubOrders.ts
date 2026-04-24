import { useState, useEffect, useCallback } from "react";
import { mapOrderRow, mapDeliveryOrderRow, HubOrder } from "@/services/hubService";
import { updateOrderStatus, updateDeliveryOrderStatus } from "@/services/hubService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to both the MFC `orders` table and the `delivery_orders` table
 * for orders assigned to this agent. Merges and deduplicates by id.
 */
export function useHubOrders() {
  const { agent } = useAuth();
  const [orders, setOrders] = useState<HubOrder[]>([]);

  const fetchOrders = useCallback(async () => {
    if (!agent) return;

    const [mfcResult, deliveryResult] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("agent_user_id", agent.user_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("delivery_orders")
        .select("*")
        .eq("agent_user_id", agent.user_id)
        .order("created_at", { ascending: false }),
    ]);

    const mfcOrders = (mfcResult.data || []).map(mapOrderRow);
    const deliveryOrders = (deliveryResult.data || []).map(mapDeliveryOrderRow);

    // Merge — MFC orders first, then delivery orders; deduplicate by id
    const seen = new Set<string>();
    const merged: HubOrder[] = [];
    for (const o of [...mfcOrders, ...deliveryOrders]) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        merged.push(o);
      }
    }

    setOrders(merged);
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    fetchOrders();

    // Subscribe to MFC orders assigned to this agent
    const mfcChannel = supabase
      .channel(`agent-mfc-orders-${agent.user_id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `agent_user_id=eq.${agent.user_id}`,
      }, () => fetchOrders())
      .subscribe();

    // Subscribe to delivery_orders assigned to this agent
    const deliveryChannel = supabase
      .channel(`agent-delivery-orders-${agent.user_id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "delivery_orders",
        filter: `agent_user_id=eq.${agent.user_id}`,
      }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(mfcChannel);
      supabase.removeChannel(deliveryChannel);
    };
  }, [agent, fetchOrders]);

  const updateStatus = useCallback(
    async (orderId: string, status: string, cancelReason?: string) => {
      // Find the order to know which table it came from
      const order = orders.find(o => o.id === orderId || o.hubOrderId === orderId);
      if (order?.sourceTable === "delivery") {
        return updateDeliveryOrderStatus(orderId, status, cancelReason);
      }
      return updateOrderStatus(orderId, status, agent?.user_id, cancelReason);
    },
    [agent, orders]
  );

  return { orders, hubConnected: true, updateStatus };
}
