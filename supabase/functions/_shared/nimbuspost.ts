/**
 * Nimbuspost Partners API (api.nimbuspost.com/v1).
 * Login is documented (POST /users/login). Shipment creation payload may vary — verify against
 * https://documenter.getpostman.com/view/9692837/TW6wHnoz and set NIMBUSPOST_CREATE_PATH if needed.
 */

const DEFAULT_BASE = "https://api.nimbuspost.com/v1";

export function nimbuspostApiBase(): string {
  return (Deno.env.get("NIMBUSPOST_API_BASE") ?? DEFAULT_BASE).replace(/\/$/, "");
}

/** Relative path under base for forward booking (no leading slash). */
export function nimbuspostCreatePath(): string {
  return (Deno.env.get("NIMBUSPOST_CREATE_PATH") ?? "shipments").replace(/^\//, "");
}

export async function nimbuspostLogin(
  email: string,
  password: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const base = nimbuspostApiBase();
  const res = await fetch(`${base}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: String(json.message ?? json.error ?? `Nimbuspost login HTTP ${res.status}`),
    };
  }
  const status = json.status === true;
  const dataStr = typeof json.data === "string" ? json.data : null;
  if (!status || !dataStr) {
    return {
      ok: false,
      error: String(json.message ?? "Nimbuspost login rejected"),
    };
  }
  return { ok: true, token: dataStr };
}

/** Raw forward-order create; returns parsed JSON and status. */
export async function nimbuspostCreateShipment(
  bearerToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; status: number; json: unknown } | { ok: false; status: number; error: string; json?: unknown }> {
  const base = nimbuspostApiBase();
  const path = nimbuspostCreatePath();
  const res = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => (null));
  if (!res.ok) {
    const msg = extractApiError(json) ?? `Nimbuspost create HTTP ${res.status}`;
    return { ok: false, status: res.status, error: msg, json };
  }
  return { ok: true, status: res.status, json };
}

function extractApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.message === "string") return o.message;
  if (typeof o.error === "string") return o.error;
  const data = o.data;
  if (data && typeof data === "object" && typeof (data as Record<string, unknown>).message === "string") {
    return (data as Record<string, unknown>).message as string;
  }
  return null;
}

export function extractShipmentResult(json: unknown): {
  awb: string | null;
  externalId: string | null;
  courierName: string | null;
  labelUrl: string | null;
  statusText: string | null;
} {
  if (!json || typeof json !== "object") {
    return { awb: null, externalId: null, courierName: null, labelUrl: null, statusText: null };
  }
  const root = json as Record<string, unknown>;
  const data = (root.data ?? root.response ?? root) as Record<string, unknown>;
  const pick = (obj: Record<string, unknown>, keys: string[]): string | null => {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const nested = (typeof data === "object" && data !== null) ? data as Record<string, unknown> : root;
  const awb = pick(nested, ["awb", "AWB", "airwaybill_number", "airwaybill", "tracking_number", "lrnum"]);
  const externalId = pick(nested, ["shipment_id", "order_id", "id", "np_id"]);
  const courierName = pick(nested, ["courier_name", "courier", "carrier_name", "carrier"]);
  const labelUrl = pick(nested, ["label_url", "label", "shipping_label", "label_link"]);
  const statusText = typeof nested.status === "string" ? nested.status : (typeof root.status === "string" ? root.status : null);

  return { awb, externalId, courierName, labelUrl, statusText };
}
