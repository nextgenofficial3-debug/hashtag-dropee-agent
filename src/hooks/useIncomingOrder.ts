import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { HubOrder } from "@/services/hubService";
import { mapOrderRow, mapDeliveryOrderRow } from "@/services/hubService";
import { updateOrderStatus, updateDeliveryOrderStatus } from "@/services/hubService";

export interface IncomingOrder {
  order: HubOrder;
  countdown: number;
}

/**
 * Listens for new order assignments on BOTH the `orders` (MFC) and
 * `delivery_orders` tables, scoped to this agent's user_id.
 * Fires browser notification + provides accept/reject callbacks.
 */
export function useIncomingOrder() {
  const { agent, user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingOrder | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenOrderIds = useRef<Set<string>>(new Set());

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
      n.onclick = () => { window.focus(); n.close(); };
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
          return null;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  }, [showPushNotification, playSound]);

  useEffect(() => {
    if (!user) return;

    // ── MFC orders channel ────────────────────────────────────────────────────
    const mfcChannel = supabase
      .channel(`incoming-mfc-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `agent_user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as any;
        if (["pending", "confirmed", "accepted", "ready"].includes(row.status)) {
          startCountdown(mapOrderRow(row));
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `agent_user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as any;
        const oldRow = payload.old as any;
        if (!oldRow.agent_user_id && row.agent_user_id === user.id) {
          startCountdown(mapOrderRow(row));
        }
      })
      .subscribe();

    // ── delivery_orders channel ───────────────────────────────────────────────
    const deliveryChannel = supabase
      .channel(`incoming-delivery-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "delivery_orders",
        filter: `agent_user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as any;
        // Trigger when a delivery order is assigned to us
        if (["accepted", "pending_assignment"].includes(row.status)) {
          startCountdown(mapDeliveryOrderRow(row));
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "delivery_orders",
        filter: `agent_user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as any;
        const oldRow = payload.old as any;
        // Only fire if agent_user_id was just assigned (was null/different before)
        if (!oldRow.agent_user_id && row.agent_user_id === user.id) {
          startCountdown(mapDeliveryOrderRow(row));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(mfcChannel);
      supabase.removeChannel(deliveryChannel);
    };
  }, [user, startCountdown]);

  const accept = useCallback(async () => {
    if (!incoming || !agent || !user) return;
    if (countdownRef.current) clearInterval(countdownRef.current);

    await supabase.from("agent_order_responses").insert({
      agent_id: agent.id,
      user_id: user.id,
      order_id: incoming.order.id,
      response_type: "accepted",
    } as any);

    if (incoming.order.sourceTable === "delivery") {
      await updateDeliveryOrderStatus(incoming.order.id, "accepted");
    } else {
      await updateOrderStatus(incoming.order.id, "accepted", user.id);
    }

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

    if (incoming.order.sourceTable === "delivery") {
      await supabase
        .from("delivery_orders")
        .update({ agent_id: null, agent_user_id: null, status: "pending_assignment" } as any)
        .eq("id", incoming.order.id);
    } else {
      await supabase
        .from("orders")
        .update({ agent_id: null, agent_user_id: null } as any)
        .eq("id", incoming.order.id);
    }

    setIncoming(null);
  }, [incoming, agent, user]);

  const dismiss = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setIncoming(null);
  }, []);

  return { incoming, accept, reject, dismiss };
}
