import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const webhookCors = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-nimbus-webhook-secret",
};

function extractAwb(obj: Record<string, unknown>): string | null {
  const d = obj.data;
  if (d && typeof d === "object") {
    const dw = (d as Record<string, unknown>).awb ?? (d as Record<string, unknown>).AWB;
    if (typeof dw === "string" && dw.trim()) return dw.trim();
  }
  const keys = ["awb", "AWB", "airwaybill_number", "tracking_number", "lrnum"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractStatus(obj: Record<string, unknown>): string | null {
  const keys = ["status", "delivery_status", "tracking_status", "shipment_status", "order_status"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: webhookCors });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: webhookCors });
  }

  try {
    const secret = Deno.env.get("NIMBUSPOST_WEBHOOK_SECRET")?.trim();
    if (secret) {
      const url = new URL(req.url);
      const q = url.searchParams.get("secret")?.trim();
      const h = req.headers.get("x-nimbus-webhook-secret")?.trim();
      if (q !== secret && h !== secret) {
        return new Response("Unauthorized", { status: 401, headers: webhookCors });
      }
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const awb = extractAwb(body);
    if (!awb) {
      return new Response(JSON.stringify({ error: "awb not found in payload" }), {
        status: 400,
        headers: { ...webhookCors, "Content-Type": "application/json" },
      });
    }

    const statusText = extractStatus(body);
    const admin = createServiceClient();
    const { error } = await admin
      .from("order_carrier_shipments")
      .update({
        delivery_status: statusText,
        provider_meta: body,
        updated_at: new Date().toISOString(),
      })
      .eq("awb", awb);

    if (error) {
      console.error("nimbuspost-webhook update", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...webhookCors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, awb }), {
      headers: { ...webhookCors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...webhookCors, "Content-Type": "application/json" },
    });
  }
});
