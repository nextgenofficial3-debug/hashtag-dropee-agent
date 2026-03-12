import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Loader2, RefreshCw, Package, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ExternalOrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("fetch-external-orders", {
      body: { action: "fetch" },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to fetch", description: error.message, variant: "destructive" });
      return;
    }
    setOrders(data?.orders || []);
    setFetched(true);
    toast({ title: `Fetched ${data?.total || 0} orders` });
  };

  const importOrders = async () => {
    setImporting(true);
    const { data, error } = await supabase.functions.invoke("fetch-external-orders", {
      body: { action: "import" },
    });
    setImporting(false);
    if (error) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Imported ${data?.imported || 0} orders ✓` });
    navigate("/agent/orders");
  };

  return (
    <div className="px-4 py-4 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">External Orders</h1>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold text-foreground">Connected App</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Fetch and import orders from your external ordering app into DeliverPro.
        </p>

        <div className="flex gap-2">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Fetch Orders
          </button>

          {fetched && orders.length > 0 && (
            <button
              onClick={importOrders}
              disabled={importing}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Import All
            </button>
          )}
        </div>
      </div>

      {fetched && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {orders.length} Orders Found
          </p>
          {orders.map((order: any, i: number) => (
            <div key={i} className="glass rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  {order.customer_name || order.customerName || order.customer || "Customer"}
                </p>
                {(order.status) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                    {order.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                📍 {order.delivery_address || order.deliveryAddress || order.address || order.to || "—"}
              </p>
              {(order.total_fee || order.fee || order.total || order.amount) && (
                <p className="text-xs font-semibold text-accent">
                  ₵{Number(order.total_fee || order.fee || order.total || order.amount || 0).toFixed(2)}
                </p>
              )}
            </div>
          ))}
          {orders.length === 0 && (
            <div className="glass rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">No orders found from external app</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
