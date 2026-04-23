import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapOrderRow } from "@/services/hubService";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

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
 * Legacy compatibility hook.
 * Reads the shared `orders` table so older callers stay aligned with the live flow.
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
      .from("orders")
      .select("*")
      .eq("agent_id", agentId)
      .in("status", ["pending", "confirmed", "ready", "accepted", "picked_up", "in_transit", "out_for_delivery"])
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders(
          (data || []).map((row) => {
            const mapped = mapOrderRow(row);
            return {
              id: mapped.id,
              order_code: mapped.hubOrderId,
              status: mapped.status,
              pickup_address: mapped.pickupAddress,
              delivery_address: mapped.deliveryAddress,
              total_amount: mapped.total,
              total_fee: mapped.fee,
              customer_name: mapped.customerName,
              created_at: mapped.createdAt,
              agent_id: mapped.agentId,
            };
          })
        );
        setLoading(false);
      });

    // Realtime subscription
    const channel = supabase
      .channel(`agent-orders-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload: RealtimePostgresChangesPayload<Tables<"orders">>) => {
          const mapped = payload.new ? mapOrderRow(payload.new) : null;
          if (payload.eventType === "INSERT") {
            if (!mapped) return;
            setOrders((prev) => [
              {
                id: mapped.id,
                order_code: mapped.hubOrderId,
                status: mapped.status,
                pickup_address: mapped.pickupAddress,
                delivery_address: mapped.deliveryAddress,
                total_amount: mapped.total,
                total_fee: mapped.fee,
                customer_name: mapped.customerName,
                created_at: mapped.createdAt,
                agent_id: mapped.agentId,
              },
              ...prev,
            ]);
          } else if (payload.eventType === "UPDATE") {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === payload.new.id
                  ? {
                      id: mapped?.id || o.id,
                      order_code: mapped?.hubOrderId,
                      status: mapped?.status || o.status,
                      pickup_address: mapped?.pickupAddress,
                      delivery_address: mapped?.deliveryAddress,
                      total_amount: mapped?.total,
                      total_fee: mapped?.fee,
                      customer_name: mapped?.customerName,
                      created_at: mapped?.createdAt || o.created_at,
                      agent_id: mapped?.agentId,
                    }
                  : o
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
