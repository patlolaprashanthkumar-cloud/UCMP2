const RA_BASE = "https://api.razorpay.com/v1";

function basicAuthHeader(): string {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set on Edge Functions");
  }
  const token = btoa(`${keyId}:${keySecret}`);
  return `Basic ${token}`;
}

export function getRazorpayKeyId(): string {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  if (!keyId) throw new Error("RAZORPAY_KEY_ID must be set");
  return keyId;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): Promise<boolean> {
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  if (!keySecret) return false;
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = await hmacSha256Hex(keySecret, body);
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const whSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")?.trim();
  if (!whSecret || !signatureHeader) return false;
  const expected = await hmacSha256Hex(whSecret, rawBody);
  return timingSafeEqualHex(expected, signatureHeader);
}

export type RazorpayOrderCreate = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
};

export async function razorpayCreateOrder(params: {
  amountPaise: number;
  currency?: string;
  receipt: string;
}): Promise<RazorpayOrderCreate> {
  const res = await fetch(`${RA_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(),
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency ?? "INR",
      receipt: params.receipt.slice(0, 40),
      payment_capture: 1,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Razorpay order failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as RazorpayOrderCreate;
}

export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
};

export async function razorpayFetchPayment(paymentId: string): Promise<RazorpayPayment> {
  const res = await fetch(`${RA_BASE}/payments/${paymentId}`, {
    headers: { Authorization: basicAuthHeader() },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Razorpay payment fetch failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as RazorpayPayment;
}
