import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { razorpayFetchPayment, verifyWebhookSignature } from "../_shared/razorpay.ts";
import { fulfillStoreCheckoutSession } from "../_shared/fulfillStoreCheckout.ts";
import { fulfillSaasDueCheckoutSession } from "../_shared/fulfillSaasDue.ts";

type PayEntity = {
  id: string;
  order_id?: string | null;
  amount?: number;
  status?: string;
};

function getPaymentEntity(parsed: Record<string, unknown>): PayEntity | null {
  const payload = parsed.payload as Record<string, { entity?: Record<string, unknown> }> | undefined;
  const ent = payload?.payment?.entity;
  if (!ent?.id) return null;
  return {
    id: String(ent.id),
    order_id: ent.order_id != null ? String(ent.order_id) : null,
    amount: typeof ent.amount === "number" ? ent.amount : undefined,
    status: ent.status != null ? String(ent.status) : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature");

  const admin = createServiceClient();

  try {
    const ok = await verifyWebhookSignature(raw, sig);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = String(parsed.event ?? "unknown");
    const bodyHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const bodyHash = [...new Uint8Array(bodyHashBuf)].map((x) => x.toString(16).padStart(2, "0")).join("");
    const eventId = req.headers.get("x-razorpay-event-id")?.trim() || `dedupe_${bodyHash.slice(0, 40)}`;

    const { data: existing } = await admin
      .from("razorpay_webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resultNote = "ok";

    if (eventType === "payment.captured" || eventType === "payment.authorized") {
      const pay = getPaymentEntity(parsed);
      if (pay?.order_id && pay.id) {
        let verified = pay;
        try {
          const fetched = await razorpayFetchPayment(pay.id);
          verified = {
            id: fetched.id,
            order_id: fetched.order_id,
            amount: fetched.amount,
            status: fetched.status,
          };
        } catch (e) {
          console.error("webhook payment fetch", e);
        }

        if (verified.status === "captured" || verified.status === "authorized") {
          const orderId = verified.order_id;
          const paymentId = verified.id;
          if (orderId && paymentId) {
            const { data: st } = await admin
              .from("store_checkout_sessions")
              .select("id, amount_paise, status")
              .eq("razorpay_order_id", orderId)
              .maybeSingle();

            if (st && st.status === "pending" && verified.amount === st.amount_paise) {
              const fr = await fulfillStoreCheckoutSession(
                admin,
                st.id,
                orderId,
                paymentId,
              );
              if (!fr.ok) resultNote = `store:${fr.error}`;
            }

            const { data: dueS } = await admin
              .from("saas_due_checkout_sessions")
              .select("id, amount_paise, status")
              .eq("razorpay_order_id", orderId)
              .maybeSingle();

            if (dueS && dueS.status === "pending" && verified.amount === dueS.amount_paise) {
              const fr = await fulfillSaasDueCheckoutSession(
                admin,
                dueS.id,
                orderId,
                paymentId,
              );
              if (!fr.ok) resultNote = `due:${fr.error}`;
            }
          }
        }
      }
    }

    if (eventType === "payment.failed") {
      const pay = getPaymentEntity(parsed);
      const orderId = pay?.order_id;
      if (orderId) {
        const now = new Date().toISOString();
        await admin
          .from("store_checkout_sessions")
          .update({ status: "failed", updated_at: now })
          .eq("razorpay_order_id", orderId)
          .eq("status", "pending");
        await admin
          .from("saas_due_checkout_sessions")
          .update({ status: "failed", updated_at: now })
          .eq("razorpay_order_id", orderId)
          .eq("status", "pending");
      }
    }

    await admin.from("razorpay_webhook_events").insert({
      event_id: eventId,
      event_type: eventType,
      payload: parsed,
      result: resultNote,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("razorpay-webhook", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
