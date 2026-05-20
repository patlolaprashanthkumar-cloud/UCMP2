export type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (ev: string, fn: () => void) => void;
    };
  }
}

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay script failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Razorpay script failed'));
    document.body.appendChild(s);
  });
}

export function openRazorpayModal(opts: {
  keyId: string;
  orderId: string;
  name: string;
  description?: string;
  prefillEmail?: string;
  prefillContact?: string;
  themeColor?: string;
  onSuccess: (res: RazorpayHandlerResponse) => void;
  onDismiss?: () => void;
}): void {
  const R = window.Razorpay;
  if (!R) {
    throw new Error('Razorpay is not loaded');
  }
  const rzp = new R({
    key: opts.keyId,
    order_id: opts.orderId,
    name: opts.name,
    description: opts.description ?? 'Order payment',
    prefill: {
      email: opts.prefillEmail,
      contact: opts.prefillContact,
    },
    theme: { color: opts.themeColor ?? '#0f766e' },
    handler(resp: RazorpayHandlerResponse) {
      opts.onSuccess(resp);
    },
  });
  if (opts.onDismiss && typeof rzp.on === 'function') {
    rzp.on('payment.failed', () => opts.onDismiss?.());
  }
  rzp.open();
}
