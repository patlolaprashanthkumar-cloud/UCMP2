import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";
import { bookNimbuspostForOrder } from "../_shared/bookNimbuspost.ts";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { user, error: authErr } = await requireUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: authErr ?? "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { order_ids?: string[] };
    const ids = [...new Set((body.order_ids ?? []).filter((id) => isUuid(id)))];
    if (!ids.length) {
      return new Response(JSON.stringify({ error: "order_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createServiceClient();

    const authorized: string[] = [];
    for (const orderId of ids) {
      const { data: order, error } = await admin
        .from("orders")
        .select("buyer_id, tenant_id")
        .eq("id", orderId)
        .maybeSingle();
      if (error || !order) {
        return new Response(JSON.stringify({ error: `Order not found: ${orderId}` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isBuyer = order.buyer_id === user.id;
      let isOwner = false;
      if (order.tenant_id) {
        const { data: tenant } = await admin
          .from("saas_tenants")
          .select("owner_id")
          .eq("id", order.tenant_id)
          .maybeSingle();
        isOwner = tenant?.owner_id === user.id;
      }

      if (!isBuyer && !isOwner) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authorized.push(orderId);
    }

    const results: { order_id: string; ok: boolean; error?: string }[] = [];
    for (const orderId of authorized) {
      const r = await bookNimbuspostForOrder(admin, orderId);
      results.push({ order_id: orderId, ok: r.ok, error: r.ok ? undefined : r.error });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
