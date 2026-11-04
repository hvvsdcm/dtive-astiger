/** Shipping rule from site_settings. Display only: create_order computes the real amounts. */
export type ShippingRule = {
  shipping_fee: number;
  free_shipping_threshold: number | null;
};

/** Same rule as create_order: free from the threshold (when one is set), otherwise the flat fee. */
export function shippingFeeFor(subtotal: number, rule: ShippingRule): number {
  const free = rule.free_shipping_threshold !== null && subtotal >= rule.free_shipping_threshold;
  return free ? 0 : rule.shipping_fee;
}

/** Amount still needed for free shipping, or null when there is nothing to show. */
export function freeShippingRemaining(subtotal: number, rule: ShippingRule): number | null {
  if (rule.free_shipping_threshold === null || rule.shipping_fee === 0) return null;
  const remaining = rule.free_shipping_threshold - subtotal;
  return remaining > 0 ? remaining : null;
}
