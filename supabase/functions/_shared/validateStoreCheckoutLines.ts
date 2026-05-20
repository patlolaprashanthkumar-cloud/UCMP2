import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import type { StoredSessionLine } from "./fulfillStoreCheckout.ts";

function sellableUnits(listingQty: number, stock: number): number {
  const l = Math.max(0, Math.floor(Number(listingQty)) || 0);
  const s = Math.max(0, Math.floor(Number(stock)) || 0);
  return Math.min(l, s);
}

export type ClientLineInput = {
  product_id: string;
  quantity: number;
  size?: string | null;
  offered_by_reseller_id?: string | null;
  purchase_intent?: string | null;
  cart_line_id?: string | null;
};

export async function buildValidatedStoreLines(
  admin: SupabaseClient,
  tenantId: string,
  buyerId: string,
  inputs: ClientLineInput[],
): Promise<
  | { ok: true; lines: StoredSessionLine[]; amountPaise: number }
  | { ok: false; error: string }
> {
  if (!inputs.length) return { ok: false, error: "No lines" };

  const inputsNorm = inputs.map((i) => ({
    product_id: i.product_id,
    quantity: Math.max(1, Math.floor(Number(i.quantity)) || 1),
    size: i.size ?? null,
    offered_by_reseller_id: i.offered_by_reseller_id ?? null,
    purchase_intent: i.purchase_intent ?? null,
    cart_line_id: i.cart_line_id ?? null,
  }));

  const productIds = [...new Set(inputsNorm.map((i) => i.product_id))];

  const { data: products, error: pErr } = await admin
    .from("products")
    .select("id, price, stock, sizes, is_active")
    .in("id", productIds);

  if (pErr || !products?.length) {
    return { ok: false, error: pErr?.message ?? "Products not found" };
  }

  const prodMap = new Map(
    products.map((p: Record<string, unknown>) => [p.id as string, p]),
  );

  const { data: links, error: lErr } = await admin
    .from("tenant_products")
    .select("product_id, listing_quantity")
    .eq("tenant_id", tenantId)
    .in("product_id", productIds);

  if (lErr || !links?.length) {
    return { ok: false, error: lErr?.message ?? "Store listing not found" };
  }

  const listingMap = new Map(
    (links as { product_id: string; listing_quantity: number }[]).map((r) => [
      r.product_id,
      Number(r.listing_quantity) || 0,
    ]),
  );

  const resellerIds = [
    ...new Set(
      inputsNorm.map((i) => i.offered_by_reseller_id).filter(Boolean) as string[],
    ),
  ];

  let marginRows: { product_id: string; user_id: string; margin_amount: number }[] = [];
  if (resellerIds.length) {
    const { data: m } = await admin
      .from("tenant_store_reseller_product_margins")
      .select("product_id, user_id, margin_amount")
      .eq("tenant_id", tenantId)
      .in("product_id", productIds);
    marginRows = (m ?? []) as typeof marginRows;
  }
  const marginMap = new Map(
    marginRows.map((m) => [`${m.product_id}:${m.user_id}`, Number(m.margin_amount)]),
  );

  const cartIds = [
    ...new Set(
      inputsNorm.map((i) => i.cart_line_id).filter(Boolean) as string[],
    ),
  ];
  if (cartIds.length) {
    const { data: carts, error: cErr } = await admin
      .from("store_cart_items")
      .select("id, tenant_id, user_id, product_id, quantity")
      .in("id", cartIds);
    if (cErr) return { ok: false, error: cErr.message };
    const cartById = new Map(
      (carts ?? []).map((c: Record<string, unknown>) => [c.id as string, c]),
    );
    for (const inp of inputsNorm) {
      if (!inp.cart_line_id) continue;
      const row = cartById.get(inp.cart_line_id) as
        | { tenant_id: string; user_id: string; product_id: string }
        | undefined;
      if (!row || row.tenant_id !== tenantId || row.user_id !== buyerId) {
        return { ok: false, error: "Invalid cart line" };
      }
      if (row.product_id !== inp.product_id) {
        return { ok: false, error: "Cart line product mismatch" };
      }
    }
  }

  const out: StoredSessionLine[] = [];
  let amountInr = 0;

  for (const inp of inputsNorm) {
    const p = prodMap.get(inp.product_id) as
      | {
        id: string;
        price: number;
        stock: number;
        sizes?: string[];
        is_active: boolean;
      }
      | undefined;
    if (!p || !p.is_active) {
      return { ok: false, error: "Product unavailable" };
    }
    const lq = listingMap.get(inp.product_id);
    if (lq === undefined) {
      return { ok: false, error: "Product not listed in this store" };
    }
    const sellable = sellableUnits(lq, p.stock);
    if (sellable < 1) {
      return { ok: false, error: "Insufficient storefront listing quantity for this product" };
    }
    const qty = Math.min(inp.quantity, sellable);

    const opts = p.sizes && p.sizes.length > 0 ? p.sizes : [];
    let size: string | null = inp.size ?? null;
    if (opts.length > 0) {
      if (!size || !opts.includes(size)) {
        size = opts[0] ?? null;
      }
    } else {
      size = null;
    }

    let unitPrice = Number(p.price) || 0;
    if (inp.purchase_intent === "resale_stock") {
      unitPrice = Number(p.price) || 0;
    } else if (inp.offered_by_reseller_id) {
      const add =
        marginMap.get(`${inp.product_id}:${inp.offered_by_reseller_id}`) ?? 0;
      if (add > 0) {
        unitPrice = (Number(p.price) || 0) + add;
      }
    }

    unitPrice = Math.round(unitPrice * 100) / 100;
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    amountInr += lineTotal;

    out.push({
      product_id: inp.product_id,
      quantity: qty,
      unit_price_inr: unitPrice,
      size: opts.length ? size : null,
      offered_by_reseller_id: inp.offered_by_reseller_id,
      purchase_intent: inp.purchase_intent,
      cart_line_id: inp.cart_line_id,
    });
  }

  if (!out.length) {
    return { ok: false, error: "Nothing to checkout" };
  }

  const amountPaise = Math.round(amountInr * 100);
  if (amountPaise < 1) {
    return { ok: false, error: "Invalid amount" };
  }

  return { ok: true, lines: out, amountPaise };
}
