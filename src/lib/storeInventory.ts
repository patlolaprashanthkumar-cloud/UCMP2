/**
 * Units sellable on a tenant storefront: capped by SaaS listing allocation and vendor stock.
 */
export function storeSellableUnits(listingQuantity: number, productStock: number): number {
  const l = Math.max(0, Math.floor(Number(listingQuantity)) || 0);
  const s = Math.max(0, Math.floor(Number(productStock)) || 0);
  return Math.min(l, s);
}
