/**
 * Order Service
 *
 * All order interactions go directly through the shared Supabase backend
 * (MFC orders table). The previous WebSocket hub abstraction has been replaced
 * with native Supabase PostgREST + Realtime so both apps share one data flow.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type SharedOrderRow = Tables<"orders">;

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

const DB_TO_UI_STATUS: Record<string, HubOrder["status"]> = {
  pending: "assigned",
  confirmed: "assigned",
  preparing: "assigned",
  ready: "assigned",
  accepted: "assigned",
  assigned: "assigned",
  en_route_pickup: "assigned",
  arrived_pickup: "assigned",
  picked_up: "picked_up",
  in_transit: "on_the_way",
  out_for_delivery: "on_the_way",
  arrived_delivery: "on_the_way",
  on_the_way: "on_the_way",
  delivered: "delivered",
  cancelled: "cancelled",
};

const UI_TO_DB_STATUS: Record<string, string> = {
  assigned: "accepted",
  on_the_way: "in_transit",
};

/**
 * Maps a raw `orders` row from Supabase into the HubOrder shape used by all
 * agent components. Status values are mapped from the MFC status strings.
 */
export function mapOrderRow(row: SharedOrderRow | Record<string, unknown>): HubOrder {
  const order = row as SharedOrderRow & Record<string, unknown>;
  return {
    id: order.id,
    hubOrderId: order.hub_order_id || order.id,
    customerName: order.customer_name,
    customerPhone: order.customer_phone || undefined,
    pickupAddress: order.pickup_address || undefined,
    deliveryAddress: order.customer_address,
    specialInstructions: order.special_instructions || undefined,
    items: Array.isArray(order.items) ? (order.items as HubOrder["items"]) : [],
    total: order.total || 0,
    sourceSite: "MFC",
    status: mapStatus(order.status),
    agentId: order.agent_id || "",
    agentName: "",
    createdAt: order.created_at,
    fee: order.fee || 0,
  };
}

function mapStatus(status: string): HubOrder["status"] {
  return DB_TO_UI_STATUS[status] || "assigned";
}

function mapStatusForWrite(status: string) {
  return UI_TO_DB_STATUS[status] || status;
}

export async function findSharedOrderByIdentifier(orderIdentifier: string) {
  const byId = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderIdentifier)
    .maybeSingle();

  if (byId.data) return byId.data;

  const byHubOrderId = await supabase
    .from("orders")
    .select("*")
    .eq("hub_order_id", orderIdentifier)
    .maybeSingle();

  return byHubOrderId.data ?? null;
}

/**
 * Update the status of an order in the shared orders table.
 * Also appends a row to order_status_timeline for audit trail.
 */
export async function updateOrderStatus(
  orderIdentifier: string,
  status: string,
  agentUserId?: string,
  cancelReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await findSharedOrderByIdentifier(orderIdentifier);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const nextStatus = mapStatusForWrite(status);
    const updates: TablesUpdate<"orders"> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", order.id);

    if (error) return { success: false, error: error.message };

    // Append to timeline if user id is known
    if (agentUserId) {
      const timelineEntry: TablesInsert<"order_status_timeline"> = {
        order_id: order.id,
        status: nextStatus,
        user_id: agentUserId,
        notes: cancelReason || null,
      };
      await supabase.from("order_status_timeline").insert(timelineEntry);
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
