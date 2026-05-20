import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/auth.ts";
import { getRazorpayKeyId, razorpayCreateOrder } from "../_shared/razorpay.ts";
import { buildValidatedStoreLines, type ClientLineInput } from "../_shared/validateStoreCheckoutLines.ts";

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

    const body = await req.json() as {
      tenant_id?: string;
      lines?: ClientLineInput[];
      idempotency_key?: string;
      affiliate_id?: string | null;
      fallback_reseller_id?: string | null;
      customer_email?: string | null;
      customer_phone?: string | null;
      shipping_snapshot?: Record<string, unknown> | null;
    };

    const tenantId = body.tenant_id;
    const idempotencyKey = body.idempotency_key?.trim();
    const linesIn = body.lines;

    if (!tenantId || !isUuid(tenantId) || !idempotencyKey || !linesIn?.length) {
      return new Response(JSON.stringify({ error: "tenant_id, idempotency_key, and lines required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let affiliateId: string | null = body.affiliate_id && isUuid(body.affiliate_id) &&
        body.affiliate_id !== user.id
      ? body.affiliate_id
      : null;
    let fallbackReseller: string | null =
      body.fallback_reseller_id && isUuid(body.fallback_reseller_id) &&
        body.fallback_reseller_id !== user.id
        ? body.fallback_reseller_id
        : null;

    const admin = createServiceClient();

    const { data: tenant, error: tErr } = await admin
      .from("saas_tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();
    if (tErr || !tenant) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validated = await buildValidatedStoreLines(
      admin,
      tenantId,
      user.id,
      linesIn,
    );
    if (!validated.ok) {
      return new Response(JSON.stringify({ error: validated.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await admin
      .from("store_checkout_sessions")
      .select("*")
      .eq("buyer_id", user.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.status === "paid") {
      return new Response(JSON.stringify({ error: "Checkout already completed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      existing &&
      existing.status === "pending" &&
      existing.amount_paise === validated.amountPaise &&
      existing.razorpay_order_id
    ) {
      return new Response(
        JSON.stringify({
          session_id: existing.id,
          razorpay_order_id: existing.razorpay_order_id,
          amount: validated.amountPaise,
          currency: "INR",
          key_id: getRazorpayKeyId(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const receipt = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) ||
      crypto.randomUUID().replace(/-/g, "").slice(0, 32);

    const rzOrder = validated.amountPaise > 0
      ? await razorpayCreateOrder({
        amountPaise: validated.amountPaise,
        currency: "INR",
        receipt,
      })
      : null;

    if (!rzOrder) {
      throw new Error("Razorpay order missing");
    }

    const row = {
      buyer_id: user.id,
      tenant_id: tenantId,
      idempotency_key: idempotencyKey,
      amount_paise: validated.amountPaise,
      currency: "INR",
      lines: validated.lines,
      affiliate_id: affiliateId,
      fallback_reseller_id: fallbackReseller,
      customer_email: body.customer_email?.trim() || user.email || null,
      customer_phone: body.customer_phone?.trim() || null,
      shipping_snapshot: body.shipping_snapshot ?? null,
      razorpay_order_id: rzOrder.id,
      status: "pending" as const,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: upErr } = await admin
        .from("store_checkout_sessions")
        .update(row)
        .eq("id", existing.id);
      if (upErr) throw upErr;

      return new Response(
        JSON.stringify({
          session_id: existing.id,
          razorpay_order_id: rzOrder.id,
          amount: validated.amountPaise,
          currency: "INR",
          key_id: getRazorpayKeyId(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: inserted, error: insErr } = await admin
      .from("store_checkout_sessions")
      .insert(row)
      .select("id")
      .single();

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: again } = await admin
          .from("store_checkout_sessions")
          .select("*")
          .eq("buyer_id", user.id)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (again?.razorpay_order_id) {
          return new Response(
            JSON.stringify({
              session_id: again.id,
              razorpay_order_id: again.razorpay_order_id,
              amount: validated.amountPaise,
              currency: "INR",
              key_id: getRazorpayKeyId(),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      throw insErr;
    }

    return new Response(
      JSON.stringify({
        session_id: inserted!.id,
        razorpay_order_id: rzOrder.id,
        amount: validated.amountPaise,
        currency: "INR",
        key_id: getRazorpayKeyId(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("create-razorpay-order", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
