import type { ShopRules } from '@/content/types';
import { useSiteSettings } from '@/features/checkout/api';

/**
 * Shipping fee, free-shipping threshold and payment window from site_settings (admin-editable), so
 * the legal and help texts always quote the numbers the checkout charges. The route loaders warm
 * the cache; until it resolves (or if it fails) the texts use wording without numbers.
 */
export function useShopRules(): ShopRules {
  const { data } = useSiteSettings();
  if (!data) return null;
  return {
    shippingFee: data.shipping_fee,
    freeShippingThreshold: data.free_shipping_threshold,
    paymentDueHours: data.payment_due_hours,
  };
}
