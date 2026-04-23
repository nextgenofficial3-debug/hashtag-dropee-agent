import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_API_URL =
  "https://jwflhzyqcmwmehnhvbwf.supabase.co/functions/v1/orders-api";
const EXTERNAL_API_KEY =
  "be66b49e6bd36862dddc745ce6148ae021adf01a473e8a36d736f0c4e70eed62";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json().catch(() => ({}));
    const action = body.action || "fetch"; // fetch | import

    // Fetch orders from external API
    const extRes = await fetch(EXTERNAL_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EXTERNAL_API_KEY,
      },
    });

    if (!extRes.ok) {
      const errText = await extRes.text();
      return new Response(
        JSON.stringify({ error: "External API error", details: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const extData = await extRes.json();
    const orders = Array.isArray(extData) ? extData : extData.orders || extData.data || [];

    if (action === "import" && orders.length > 0) {
      // Import orders into the shared orders table using service role
      const adminClient = createClient(supabaseUrl, serviceKey);

      // Get agent info
      const { data: agent } = await adminClient
        .from("delivery_agents")
        .select("id, user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!agent) {
        return new Response(
          JSON.stringify({ error: "Agent not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let imported = 0;
      for (const order of orders) {
        const orderCode = `EXT-${(order.id || Date.now()).toString().slice(-8)}-${Date.now().toString(36).toUpperCase()}`;

        // Check if already imported by looking for external reference
        const customerName = order.customer_name || order.customerName || order.customer || "External Customer";
        const customerPhone = order.customer_phone || order.customerPhone || order.phone || null;
        const pickupAddr = order.pickup_address || order.pickupAddress || order.restaurant_address || order.from || "External Pickup";
        const deliveryAddr = order.delivery_address || order.deliveryAddress || order.address || order.to || "External Delivery";
        const instructions = order.special_instructions || order.instructions || order.notes || null;
        const fee = order.total_fee || order.fee || order.amount || order.total || 0;
        const itemName = order.item_name || order.package_description || order.description || "External Order";
        const itemQty = Number(order.quantity || 1) || 1;
        const itemPrice = Number(fee) || 0;

        const { error: insertError } = await adminClient
          .from("orders")
          .insert({
            hub_order_id: orderCode,
            customer_name: customerName,
            customer_phone: customerPhone,
            pickup_address: pickupAddr,
            customer_address: deliveryAddr,
            special_instructions: instructions,
            items: [{ name: itemName, quantity: itemQty, price: itemPrice }],
            agent_id: agent.id,
            agent_user_id: agent.user_id,
            status: "accepted",
            fee: Number(fee) || 0,
            subtotal: Number(fee) || 0,
            total: Number(fee) || 0,
            payment_method: order.payment_method || "cash",
            updated_at: new Date().toISOString(),
          });

        if (!insertError) {
          imported++;
          // Create notification
          await adminClient.from("notifications").insert({
            user_id: agent.user_id,
            title: "External Order Imported",
            message: `Order for ${customerName} at ${deliveryAddr}`,
            type: "new_order",
            metadata: { order_code: orderCode, source: "external_api" },
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          total_fetched: orders.length,
          imported,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Just return the orders for preview
    return new Response(JSON.stringify({ orders, total: orders.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
