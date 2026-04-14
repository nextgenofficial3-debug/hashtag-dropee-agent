import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { HubOrder } from "@/services/hubService";
import { mapOrderRow } from "@/services/hubService";
import { updateOrderStatus } from "@/services/hubService";

export interface IncomingOrder {
  order: HubOrder;
  countdown: number;
}

/**
 * Listens for new order assignments via Supabase Realtime (INSERT + UPDATE)
 * on the shared `orders` table, scoped to this agent's user_id.
 * Fires browser notification + provides accept/reject callbacks.
 */
export function useIncomingOrder() {
  const { agent, user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingOrder | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenOrderIds = useRef<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const showPushNotification = useCallback((order: HubOrder) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification("New Delivery Request!", {
        body: `${order.customerName} — ${order.deliveryAddress}\nFee: ₵${order.fee.toFixed(2)}`,
        icon: "/icon-192.png",
        tag: "incoming-order",
        requireInteraction: true,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  }, []);

  const playSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 300);
    } catch { /* silent */ }
  }, []);

  const startCountdown = useCallback((order: HubOrder) => {
    if (seenOrderIds.current.has(order.id)) return;
    seenOrderIds.current.add(order.id);

    if (countdownRef.current) clearInterval(countdownRef.current);
    setIncoming({ order, countdown: 30 });
    showPushNotification(order);
    playSound();

    countdownRef.current = setInterval(() => {
      setIncoming((prev) => {
        if (!prev) return null;
        if (prev.countdown <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return null; // Auto-dismiss on timeout
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  }, [showPushNotification, playSound]);

  // Listen to Supabase realtime for INSERT on orders assigned to this agent
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`incoming-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `agent_user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          // Only trigger incoming alert for orders that look newly assigned
          const status = row.status;
          if (status && ["pending", "confirmed", "accepted", "ready"].includes(status)) {
            startCountdown(mapOrderRow(row));
          }
        }
      )
      // Also watch for UPDATE so if MFC assigns an existing order to us:
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `agent_user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          const oldRow = payload.old as any;
          // Only fire if agent_user_id was just assigned (was null before)
          if (!oldRow.agent_user_id && row.agent_user_id === user.id) {
            startCountdown(mapOrderRow(row));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, startCountdown]);

  const accept = useCallback(async () => {
    if (!incoming || !agent || !user) return;
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Record acceptance in agent_order_responses
    await supabase.from("agent_order_responses").insert({
      agent_id: agent.id,
      user_id: user.id,
      order_id: incoming.order.id,
      response_type: "accepted",
    } as any);

    // Update the shared order status
    await updateOrderStatus(incoming.order.id, "accepted", user.id);

    setIncoming(null);
  }, [incoming, agent, user]);

  const reject = useCallback(async () => {
    if (!incoming || !agent || !user) return;
    if (countdownRef.current) clearInterval(countdownRef.current);

    await supabase.from("agent_order_responses").insert({
      agent_id: agent.id,
      user_id: user.id,
      order_id: incoming.order.id,
      response_type: "rejected",
      reason: "Agent rejected",
    } as any);

    // Unassign from this agent so MFC can reassign
    await supabase
      .from("orders")
      .update({ agent_id: null, agent_user_id: null } as any)
      .eq("id", incoming.order.id);

    setIncoming(null);
  }, [incoming, agent, user]);

  const dismiss = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setIncoming(null);
  }, []);

  return { incoming, accept, reject, dismiss };
}
