import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { bookNimbuspostForOrder } from "./bookNimbuspost.ts";

export type StoredSessionLine = {
  product_id: string;
  quantity: number;
  unit_price_inr: number;
  /** Catalog base unit price (INR) at checkout, before reseller margin. */
  store_base_unit_price_inr?: number;
  /** Extra INR per unit owed to reseller; 0 when not a margin line. */
  reseller_margin_unit_inr?: number;
  size: string | null;
  offered_by_reseller_id: string | null;
  purchase_intent: string | null;
  cart_line_id: string | null;
};

/** Derive base / margin units from persisted line JSON (new sessions include both; legacy may omit). */
function baseMarginUnitsFromLine(line: StoredSessionLine): { baseU: number; marginU: number } {
  const b = line.store_base_unit_price_inr;
  const m = line.reseller_margin_unit_inr;
  if (b != null && m != null) {
    return { baseU: Number(b), marginU: Number(m) };
  }
  if (b != null) {
    const baseU = Number(b);
    return {
      baseU,
      marginU: Math.max(0, Math.round((line.unit_price_inr - baseU) * 100) / 100),
    };
  }
  if (m != null) {
    const marginU = Number(m);
    return {
      baseU: Math.round((line.unit_price_inr - marginU) * 100) / 100,
      marginU,
    };
  }
  return { baseU: line.unit_price_inr, marginU: 0 };
}

export async function fulfillStoreCheckoutSession(
  admin: SupabaseClient,
  sessionId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: session, error: sErr } = await admin
    .from("store_checkout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session) {
    return { ok: false, error: sErr?.message ?? "Session not found" };
  }

  if (session.status === "paid") {
    return { ok: true };
  }

  if (session.razorpay_order_id && session.razorpay_order_id !== razorpayOrderId) {
    return { ok: false, error: "Razorpay order mismatch" };
  }

  const { data: existingOrders } = await admin
    .from("orders")
    .select("id")
    .eq("checkout_session_id", sessionId)
    .limit(1);

  if (existingOrders && existingOrders.length > 0) {
    await admin
      .from("store_checkout_sessions")
      .update({
        status: "paid",
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    return { ok: true };
  }

  const lines = session.lines as StoredSessionLine[];
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "Session has no lines" };
  }

  const { data: tenant, error: tErr } = await admin
    .from("saas_tenants")
    .select("default_affiliate_platform_fee_percent")
    .eq("id", session.tenant_id)
    .maybeSingle();

  if (tErr || !tenant) {
    return { ok: false, error: tErr?.message ?? "Tenant not found" };
  }

  const affiliatePct = Number(
    tenant.default_affiliate_platform_fee_percent ?? 0,
  );
  const hasAffiliate = Boolean(session.affiliate_id) && affiliatePct > 0;

  for (const line of lines) {
    const lineTotal = Math.round(line.unit_price_inr * line.quantity * 100) / 100;
    const { baseU, marginU } = baseMarginUnitsFromLine(line);
    let storeBaseLineTotal = Math.round(baseU * line.quantity * 100) / 100;
    let resellerMarginTotal = Math.round(marginU * line.quantity * 100) / 100;
    const combined = Math.round((storeBaseLineTotal + resellerMarginTotal) * 100) / 100;
    if (Math.abs(combined - lineTotal) > 0.005) {
      resellerMarginTotal = Math.round((lineTotal - storeBaseLineTotal) * 100) / 100;
    }
    let affiliateCommission: number | null = null;
    let commissionNote: string | null = null;
    if (hasAffiliate && session.affiliate_id) {
      affiliateCommission = Math.round(lineTotal * (affiliatePct / 100) * 100) / 100;
      commissionNote = `Auto ${affiliatePct}% of line (store default)`;
    }

    const resellerId =
      line.offered_by_reseller_id ?? session.fallback_reseller_id ?? null;

    const { data: inserted, error: insErr } = await admin.from("orders").insert({
      buyer_id: session.buyer_id,
      product_id: line.product_id,
      quantity: line.quantity,
      total_amount: lineTotal,
      store_base_line_total: storeBaseLineTotal,
      reseller_margin_total: resellerMarginTotal,
      status: "confirmed",
      tenant_id: session.tenant_id,
      affiliate_id: session.affiliate_id,
      reseller_id: resellerId,
      payment_timing: "prepaid",
      payment_status: "paid",
      payment_provider: "razorpay",
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      customer_email: session.customer_email,
      customer_phone: session.customer_phone,
      shipping_snapshot: session.shipping_snapshot,
      size: line.size,
      order_kind: "storefront",
      checkout_session_id: sessionId,
      affiliate_commission_amount: affiliateCommission,
      affiliate_commission_note: commissionNote,
    }).select("id").single();

    if (insErr || !inserted?.id) {
      return { ok: false, error: insErr?.message ?? "Order insert failed" };
    }

    const booked = await bookNimbuspostForOrder(admin, inserted.id as string);
    if (!booked.ok) {
      console.error("bookNimbuspostForOrder failed", inserted.id, booked.error);
    }

    if (line.cart_line_id) {
      await admin.from("store_cart_items").delete().eq("id", line.cart_line_id);
    }
  }

  await admin
    .from("store_checkout_sessions")
    .update({
      status: "paid",
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: razorpayOrderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  return { ok: true };
}
