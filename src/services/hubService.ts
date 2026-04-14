/**
 * Order Service
 *
 * All order interactions go directly through the shared Supabase backend
 * (MFC orders table). The previous WebSocket hub abstraction has been replaced
 * with native Supabase PostgREST + Realtime so both apps share one data flow.
 */

import { supabase } from "@/integrations/supabase/client";

export interface HubOrder {
  id: string;
  hubOrderId: string; // maps to orders.hub_order_id or orders.id
  customerName: string;
  customerPhone?: string;
  pickupAddress?: string;
  deliveryAddress: string; // maps to orders.customer_address
  specialInstructions?: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  sourceSite: string;
  status: "assigned" | "picked_up" | "on_the_way" | "delivered" | "cancelled";
  agentId: string;
  agentName: string;
  createdAt: string;
  fee: number;
  cancelReason?: string;
}

/**
 * Maps a raw `orders` row from Supabase into the HubOrder shape used by all
 * agent components. Status values are mapped from the MFC status strings.
 */
export function mapOrderRow(row: any): HubOrder {
  return {
    id: row.id,
    hubOrderId: row.hub_order_id || row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || undefined,
    pickupAddress: row.pickup_address || undefined,
    deliveryAddress: row.customer_address,
    specialInstructions: row.special_instructions || undefined,
    items: Array.isArray(row.items) ? row.items : [],
    total: row.total || 0,
    sourceSite: "MFC",
    status: mapStatus(row.status),
    agentId: row.agent_id || "",
    agentName: "",
    createdAt: row.created_at,
    fee: row.fee || 0,
  };
}

function mapStatus(status: string): HubOrder["status"] {
  const map: Record<string, HubOrder["status"]> = {
    // MFC statuses
    pending: "assigned",
    confirmed: "assigned",
    preparing: "assigned",
    ready: "assigned",
    // Agent workflow statuses stored on the orders row
    accepted: "assigned",
    en_route_pickup: "assigned",
    arrived_pickup: "assigned",
    picked_up: "picked_up",
    in_transit: "on_the_way",
    arrived_delivery: "on_the_way",
    out_for_delivery: "on_the_way",
    delivered: "delivered",
    cancelled: "cancelled",
  };
  return map[status] || "assigned";
}

/**
 * Update the status of an order in the shared orders table.
 * Also appends a row to order_status_timeline for audit trail.
 */
export async function updateOrderStatus(
  orderId: string,
  status: string,
  agentUserId?: string,
  cancelReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", orderId);

    if (error) return { success: false, error: error.message };

    // Append to timeline if user id is known
    if (agentUserId) {
      await supabase.from("order_status_timeline").insert({
        order_id: orderId,
        status,
        user_id: agentUserId,
        notes: cancelReason || null,
      } as any);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Update availability status for the agent in agent_availability table.
 */
export async function updateAgentAvailability(
  agentId: string,
  userId: string,
  status: "online" | "offline" | "busy"
): Promise<void> {
  await supabase
    .from("agent_availability")
    .upsert(
      {
        agent_id: agentId,
        user_id: userId,
        status,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" }
    );
}

// ── Legacy shim — keeps existing callers working without changes ──────────────
// Components that imported hubService.updateOrderStatus() will still work.
class HubServiceShim {
  async updateOrderStatus(
    hubOrderId: string,
    status: string,
    cancelReason?: string
  ): Promise<{ success: boolean; error?: string }> {
    // hubOrderId may be the orders.id or hub_order_id; try direct id first.
    return updateOrderStatus(hubOrderId, status, undefined, cancelReason);
  }

  sendAvailability(_status: "online" | "offline" | "busy") {
    // No-op shim — callers should use updateAgentAvailability() directly
  }

  connect(_agentId: string, _agentName: string) {
    // No-op: no WebSocket needed
  }

  disconnect() {
    // No-op
  }

  get isConnected() {
    return true; // Always connected via Supabase
  }

  onConnectionChange(handler: (connected: boolean) => void) {
    handler(true);
    return () => {};
  }

  onOrdersUpdate(_handler: (orders: HubOrder[]) => void) {
    // No-op: use useHubOrders hook which subscribes via Supabase Realtime
    return () => {};
  }
}

export const hubService = new HubServiceShim();
