/**
 * Order Service
 *
 * All order interactions go directly through the shared Supabase backend.
 * Supports both MFC `orders` table and agent `delivery_orders` table.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type SharedOrderRow = Tables<"orders">;

export interface HubOrder {
  id: string;
  hubOrderId: string;
  customerName: string;
  customerPhone?: string;
  pickupAddress?: string;
  deliveryAddress: string;
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
  /** "mfc" | "delivery" — identifies which table this came from */
  sourceTable: "mfc" | "delivery";
}

// ── MFC orders status maps ────────────────────────────────────────────────────
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

// ── delivery_orders status maps ───────────────────────────────────────────────
const DELIVERY_DB_TO_UI: Record<string, HubOrder["status"]> = {
  pending_assignment: "assigned",
  accepted: "assigned",
  en_route_pickup: "assigned",
  arrived_pickup: "assigned",
  picked_up: "picked_up",
  in_transit: "on_the_way",
  arrived_delivery: "on_the_way",
  delivered: "delivered",
  cancelled: "cancelled",
};

const UI_TO_DELIVERY_DB: Record<string, string> = {
  assigned: "accepted",
  picked_up: "picked_up",
  on_the_way: "in_transit",
  delivered: "delivered",
  cancelled: "cancelled",
};

/**
 * Maps a raw `orders` (MFC) row to HubOrder.
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
    sourceTable: "mfc",
  };
}

/**
 * Maps a raw `delivery_orders` row to HubOrder.
 */
export function mapDeliveryOrderRow(row: Record<string, unknown>): HubOrder {
  const statusStr = String(row.status || "accepted");
  return {
    id: String(row.id),
    hubOrderId: String(row.order_code || row.id),
    customerName: String(row.customer_name || "Customer"),
    customerPhone: row.customer_phone ? String(row.customer_phone) : undefined,
    pickupAddress: row.pickup_address ? String(row.pickup_address) : undefined,
    deliveryAddress: String(row.delivery_address || ""),
    specialInstructions: row.special_instructions ? String(row.special_instructions) : undefined,
    items: [],
    total: Number(row.total_fee || 0),
    sourceSite: "Delivery",
    status: DELIVERY_DB_TO_UI[statusStr] || "assigned",
    agentId: row.agent_id ? String(row.agent_id) : "",
    agentName: "",
    createdAt: String(row.created_at || ""),
    fee: Number(row.total_fee || 0),
    cancelReason: row.cancellation_reason ? String(row.cancellation_reason) : undefined,
    sourceTable: "delivery",
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
 * Update the status of an MFC `orders` row.
 */
export async function updateOrderStatus(
  orderIdentifier: string,
  status: string,
  agentUserId?: string,
  cancelReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await findSharedOrderByIdentifier(orderIdentifier);
    if (!order) return { success: false, error: "Order not found" };

    const nextStatus = mapStatusForWrite(status);
    const updates: TablesUpdate<"orders"> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("orders").update(updates).eq("id", order.id);
    if (error) return { success: false, error: error.message };

    if (agentUserId) {
      await supabase.from("order_status_timeline").insert({
        order_id: order.id,
        status: nextStatus,
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
 * Update the status of a `delivery_orders` row.
 */
export async function updateDeliveryOrderStatus(
  orderId: string,
  status: string,
  cancelReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const nextStatus = UI_TO_DELIVERY_DB[status] || status;
    const update: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    if (cancelReason) update.cancellation_reason = cancelReason;

    const { error } = await supabase
      .from("delivery_orders")
      .update(update as any)
      .eq("id", orderId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── Legacy shim ────────────────────────────────────────────────────────────────
class HubServiceShim {
  async updateOrderStatus(
    hubOrderId: string,
    status: string,
    cancelReason?: string
  ): Promise<{ success: boolean; error?: string }> {
    return updateOrderStatus(hubOrderId, status, undefined, cancelReason);
  }
  sendAvailability(_status: "online" | "offline" | "busy") {}
  connect(_agentId: string, _agentName: string) {}
  disconnect() {}
  get isConnected() { return true; }
  onConnectionChange(handler: (connected: boolean) => void) { handler(true); return () => {}; }
  onOrdersUpdate(_handler: (orders: HubOrder[]) => void) { return () => {}; }
}

export const hubService = new HubServiceShim();
