import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  extractShipmentResult,
  nimbuspostCreateShipment,
  nimbuspostLogin,
} from "./nimbuspost.ts";

type OrderRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  quantity: number;
  total_amount: number;
  shipping_snapshot: Record<string, unknown> | null;
  customer_phone: string | null;
  customer_email: string | null;
  payment_timing: string;
  payment_status: string;
  order_kind: string | null;
};

type SettingsRow = {
  enabled: boolean;
  api_email: string;
  api_password: string;
  warehouse_id: string | null;
  default_weight_grams: number;
  default_length_cm: number;
  default_width_cm: number;
  default_height_cm: number;
};

function snapStr(s: Record<string, unknown> | null | undefined, k: string): string {
  const v = s?.[k];
  return typeof v === "string" ? v.trim() : "";
}

function buildForwardBody(
  order: OrderRow,
  productName: string,
  settings: SettingsRow,
): Record<string, unknown> {
  const snap = order.shipping_snapshot;
  const name = snapStr(snap, "full_name");
  const phone = snapStr(snap, "phone") || (order.customer_phone ?? "").trim();
  const line1 = snapStr(snap, "address_line1");
  const line2 = snapStr(snap, "address_line2");
  const city = snapStr(snap, "city");
  const state = snapStr(snap, "state");
  const pin = snapStr(snap, "postal_code");
  const addr = [line1, line2].filter(Boolean).join(", ");

  const isCod = order.payment_timing === "postpaid";

  const weightKg = Math.max(0.05, (Number(settings.default_weight_grams) || 500) / 1000);

  const body: Record<string, unknown> = {
    order_number: order.id.replace(/-/g, "").slice(0, 32),
    order_id: order.id,
    payment_type: isCod ? "cod" : "prepaid",
    cod_amount: isCod ? Number(order.total_amount) || 0 : 0,
    order_amount: Number(order.total_amount) || 0,
    package_weight: weightKg,
    package_length: Number(settings.default_length_cm) || 10,
    package_breadth: Number(settings.default_width_cm) || 10,
    package_height: Number(settings.default_height_cm) || 10,
    consignee_name: name || "Customer",
    consignee_phone: phone || "0000000000",
    consignee_email: order.customer_email ?? "",
    consignee_address: addr || "—",
    consignee_city: city || "—",
    consignee_state: state || "—",
    consignee_pincode: pin || "000000",
    consignee_country: snapStr(snap, "country") || "India",
    product_name: productName,
    product_quantity: order.quantity,
    products: [
      {
        name: productName,
        qty: order.quantity,
        price: (Number(order.total_amount) || 0) / Math.max(1, order.quantity),
      },
    ],
  };

  const wid = settings.warehouse_id?.trim();
  if (wid) body.warehouse_id = wid;

  return body;
}

/**
 * Books one Nimbuspost shipment for a storefront order line (service-role Supabase client).
 * No-ops when disabled, not storefront, or missing settings/credentials.
 */
export async function bookNimbuspostForOrder(
  admin: SupabaseClient,
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: order, error: oErr } = await admin
    .from("orders")
    .select(
      "id, tenant_id, product_id, quantity, total_amount, shipping_snapshot, customer_phone, customer_email, payment_timing, payment_status, order_kind",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (oErr || !order) {
    return { ok: false, error: oErr?.message ?? "Order not found" };
  }

  const o = order as OrderRow;
  if (o.order_kind !== "storefront" || !o.tenant_id) {
    return { ok: true };
  }

  const { data: settings } = await admin
    .from("tenant_nimbuspost_settings")
    .select(
      "enabled, api_email, api_password, warehouse_id, default_weight_grams, default_length_cm, default_width_cm, default_height_cm",
    )
    .eq("tenant_id", o.tenant_id)
    .maybeSingle();

  const cfg = settings as SettingsRow | null;
  if (!cfg?.enabled || !cfg.api_email?.trim() || !cfg.api_password?.trim()) {
    return { ok: true };
  }

  const { data: existing } = await admin
    .from("order_carrier_shipments")
    .select("id, awb")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing?.awb) {
    return { ok: true };
  }

  const { data: product } = await admin
    .from("products")
    .select("name")
    .eq("id", o.product_id)
    .maybeSingle();

  const productName = (product as { name?: string } | null)?.name?.trim() || "Product";

  const now = new Date().toISOString();
  await admin.from("order_carrier_shipments").upsert(
    {
      order_id: orderId,
      tenant_id: o.tenant_id,
      provider: "nimbuspost",
      last_error: "Booking…",
      updated_at: now,
    },
    { onConflict: "order_id" },
  );

  const login = await nimbuspostLogin(cfg.api_email.trim(), cfg.api_password);
  if (!login.ok) {
    await admin
      .from("order_carrier_shipments")
      .update({ last_error: login.error, updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
    return { ok: false, error: login.error };
  }

  const payload = buildForwardBody(o, productName, cfg);
  const created = await nimbuspostCreateShipment(login.token, payload);

  if (!created.ok) {
    const errMsg = created.error.slice(0, 2000);
    await admin
      .from("order_carrier_shipments")
      .update({
        last_error: errMsg,
        provider_meta: created.json as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);
    return { ok: false, error: errMsg };
  }

  const parsed = extractShipmentResult(created.json);
  const awb = parsed.awb;
  const errText = awb
    ? null
    : `No AWB in response (check NIMBUSPOST_CREATE_PATH / payload). Raw: ${JSON.stringify(created.json).slice(0, 500)}`;

  await admin
    .from("order_carrier_shipments")
    .update({
      external_shipment_id: parsed.externalId,
      awb: awb,
      courier_name: parsed.courierName,
      label_url: parsed.labelUrl,
      delivery_status: parsed.statusText ?? (awb ? "booked" : null),
      last_error: errText,
      provider_meta: created.json as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId);

  if (!awb) {
    return { ok: false, error: errText ?? "Missing AWB" };
  }

  return { ok: true };
}
