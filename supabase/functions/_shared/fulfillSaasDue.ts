import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

export async function fulfillSaasDueCheckoutSession(
  admin: SupabaseClient,
  sessionId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: session, error: sErr } = await admin
    .from("saas_due_checkout_sessions")
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

  const { data: due, error: dErr } = await admin
    .from("saas_tenant_platform_dues")
    .select("*")
    .eq("id", session.platform_due_id)
    .maybeSingle();

  if (dErr || !due) {
    return { ok: false, error: dErr?.message ?? "Due not found" };
  }

  if (due.status !== "pending") {
    await admin
      .from("saas_due_checkout_sessions")
      .update({
        status: "paid",
        razorpay_payment_id: razorpayPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    return { ok: true };
  }

  const { data: ten } = await admin
    .from("saas_tenants")
    .select("owner_id")
    .eq("id", due.tenant_id)
    .maybeSingle();
  if (!ten || ten.owner_id !== session.user_id) {
    return { ok: false, error: "Session user mismatch" };
  }

  const paidAt = new Date().toISOString();

  const { error: uDue } = await admin
    .from("saas_tenant_platform_dues")
    .update({
      status: "paid",
      paid_at: paidAt,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
    })
    .eq("id", due.id)
    .eq("status", "pending");

  if (uDue) {
    return { ok: false, error: uDue.message };
  }

  const { error: txErr } = await admin.from("transactions").insert({
    user_id: session.user_id,
    amount: Number(due.amount),
    type: "subscription",
    status: "completed",
    reference_id: razorpayPaymentId,
    description: `Platform due paid: ${(due.title as string)?.trim() || "SaaS platform"}`,
  });

  if (txErr) {
    console.error("transactions insert failed", txErr);
  }

  await admin
    .from("saas_due_checkout_sessions")
    .update({
      status: "paid",
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: razorpayOrderId,
      updated_at: paidAt,
    })
    .eq("id", sessionId);

  return { ok: true };
}
