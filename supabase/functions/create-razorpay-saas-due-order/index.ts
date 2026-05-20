import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";
import { getRazorpayKeyId, razorpayCreateOrder } from "../_shared/razorpay.ts";

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

    const body = await req.json() as { platform_due_id?: string };
    const dueId = body.platform_due_id;
    if (!dueId || !isUuid(dueId)) {
      return new Response(JSON.stringify({ error: "platform_due_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createServiceClient();

    const { data: due, error: dErr } = await admin
      .from("saas_tenant_platform_dues")
      .select("*")
      .eq("id", dueId)
      .maybeSingle();

    if (dErr || !due) {
      return new Response(JSON.stringify({ error: "Due not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenantRow, error: tErr } = await admin
      .from("saas_tenants")
      .select("owner_id")
      .eq("id", (due as { tenant_id: string }).tenant_id)
      .maybeSingle();

    if (tErr || !tenantRow || tenantRow.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((due as { status: string }).status !== "pending") {
      return new Response(JSON.stringify({ error: "Due is not pending" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountInr = Number((due as { amount: number }).amount);
    const amountPaise = Math.round(amountInr * 100);
    if (amountPaise < 100) {
      return new Response(JSON.stringify({ error: "Due amount too small for online payment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingOpen } = await admin
      .from("saas_due_checkout_sessions")
      .select("*")
      .eq("platform_due_id", dueId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .not("razorpay_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOpen?.razorpay_order_id) {
      const expectedPaise = Math.round(Number((due as { amount: number }).amount) * 100);
      if (existingOpen.amount_paise === expectedPaise) {
        return new Response(
          JSON.stringify({
            session_id: existingOpen.id,
            razorpay_order_id: existingOpen.razorpay_order_id,
            amount: expectedPaise,
            currency: "INR",
            key_id: getRazorpayKeyId(),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const receipt = `due_${dueId.replace(/-/g, "").slice(0, 24)}`;
    const rz = await razorpayCreateOrder({
      amountPaise,
      currency: (due as { currency?: string }).currency ?? "INR",
      receipt,
    });

    const { data: inserted, error: insErr } = await admin
      .from("saas_due_checkout_sessions")
      .insert({
        platform_due_id: dueId,
        user_id: user.id,
        amount_paise: amountPaise,
        currency: (due as { currency?: string }).currency ?? "INR",
        razorpay_order_id: rz.id,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr) throw insErr;

    return new Response(
      JSON.stringify({
        session_id: inserted!.id,
        razorpay_order_id: rz.id,
        amount: amountPaise,
        currency: "INR",
        key_id: getRazorpayKeyId(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("create-razorpay-saas-due-order", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
