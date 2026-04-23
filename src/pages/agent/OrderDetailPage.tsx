import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { findSharedOrderByIdentifier, mapOrderRow, updateOrderStatus } from "@/services/hubService";
import {
  ArrowLeft,
  MapPin,
  Phone,
  User,
  Package,
  Clock,
  Navigation,
  CheckCircle2,
  Truck,
  AlertCircle,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface Order {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  drop_address: string;
  status: string;
  total_fee: number | null;
  notes: string | null;
  created_at: string;
  items_description: string | null;
}

const STATUS_FLOW = [
  { key: "assigned", label: "Assigned", icon: Clock },
  { key: "picked_up", label: "Picked Up", icon: Package },
  { key: "on_the_way", label: "In Transit", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const NEXT_STATUS: Record<string, string> = {
  assigned: "picked_up",
  picked_up: "on_the_way",
  on_the_way: "delivered",
};

const NEXT_LABEL: Record<string, string> = {
  assigned: "Confirm Pickup",
  picked_up: "Start Delivery",
  on_the_way: "Mark Delivered",
};

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      const data = await findSharedOrderByIdentifier(orderId);
      if (!data) {
        toast({ title: "Order not found", variant: "destructive" });
        navigate(-1);
        return;
      }

      const mapped = mapOrderRow(data);
      setOrder({
        id: data.id,
        order_code: data.hub_order_id || data.id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        pickup_address: data.pickup_address || "Pickup location",
        drop_address: data.customer_address,
        status: mapped.status,
        total_fee: data.fee ?? data.total ?? null,
        notes: data.special_instructions,
        created_at: data.created_at,
        items_description: mapped.items.length
          ? mapped.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")
          : null,
      });
      setLoading(false);
    };

    fetchOrder();
  }, [orderId, navigate, toast]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order || !user) return;
    setUpdating(true);

    const { success, error } = await updateOrderStatus(order.id, newStatus, user.id);
    if (!success) {
      toast({ title: "Failed to update status", description: error, variant: "destructive" });
      setUpdating(false);
      return;
    }

    setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
    toast({ title: `Order ${newStatus.replace(/_/g, " ")} updated` });

    if (newStatus === "delivered") {
      setTimeout(() => navigate("/agent/orders"), 1500);
    }

    setUpdating(false);
  };

  const openMapsPickup = () => {
    if (!order) return;
    const query = encodeURIComponent(order.pickup_address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const openMapsDrop = () => {
    if (!order) return;
    const query = encodeURIComponent(order.drop_address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, "_blank");
  };

  const currentStepIndex = Math.max(
    STATUS_FLOW.findIndex((step) => step.key === order?.status),
    0
  );
  const nextStatus = order ? NEXT_STATUS[order.status] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto">
      <div className="sticky top-0 z-20 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Order #{order.order_code}</p>
          <p className="text-xs text-muted-foreground">{formatRelativeTime(order.created_at)}</p>
        </div>
        <span
          className={`inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full ${
            order.status === "delivered"
              ? "bg-emerald-500/15 text-emerald-400"
              : order.status === "cancelled"
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/15 text-primary"
          }`}
        >
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 space-y-4 pb-32"
      >
        <div className="glass rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Delivery Progress
          </p>
          <div className="flex justify-between items-center">
            {STATUS_FLOW.map((step, idx) => {
              const isCompleted = idx < currentStepIndex;
              const isActive = idx === currentStepIndex;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted
                        ? "bg-primary border-primary"
                        : isActive
                        ? "bg-primary/15 border-primary"
                        : "bg-secondary border-border"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isCompleted || isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <p
                    className={`text-[9px] font-medium text-center leading-tight ${
                      isActive
                        ? "text-primary"
                        : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-2xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{order.customer_name}</p>
              {order.customer_phone && (
                <a
                  href={`tel:${order.customer_phone}`}
                  className="flex items-center gap-1.5 text-xs text-primary mt-0.5"
                >
                  <Phone className="w-3 h-3" />
                  {order.customer_phone}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl border border-border p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Route</p>

          <div className="flex items-start gap-3 cursor-pointer group" onClick={openMapsPickup}>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Pickup From</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{order.pickup_address}</p>
            </div>
            <Navigation className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
          </div>

          <div className="h-px bg-border mx-4" />

          <div className="flex items-start gap-3 cursor-pointer group" onClick={openMapsDrop}>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Deliver To</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{order.drop_address}</p>
            </div>
            <Navigation className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
          </div>
        </div>

        <div className="glass rounded-2xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Info</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Items</p>
              <p className="font-medium text-foreground mt-0.5">{order.items_description || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Delivery Fee</p>
              <p className="font-semibold text-emerald-400 mt-0.5">
                {order.total_fee != null ? `Rs${order.total_fee}` : "TBD"}
              </p>
            </div>
            {order.notes && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Notes</p>
                <p className="font-medium text-foreground mt-0.5">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {nextStatus && !["delivered", "cancelled"].includes(order.status) && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-background border-t border-border">
          {order.status === "cancelled" ? (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm py-3">
              <AlertCircle className="w-4 h-4" />
              Order Cancelled
            </div>
          ) : (
            <button
              onClick={() => handleStatusUpdate(nextStatus)}
              disabled={updating}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {updating ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  {NEXT_LABEL[order.status] || "Update Status"}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {order.status === "delivered" && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-background border-t border-border">
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold text-sm py-3">
            <CheckCircle2 className="w-5 h-5" />
            Delivery Complete!
          </div>
        </div>
      )}
    </div>
  );
}
