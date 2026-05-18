export function notifyStoreBasketUpdated() {
  window.dispatchEvent(new Event('ucmp-store-basket-updated'));
}
