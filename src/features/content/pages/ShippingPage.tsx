import { shippingDocument } from '@/content/shipping';
import { DocumentPage } from '../components/DocumentPage';
import { useShopRules } from '../useShopRules';

export function ShippingPage() {
  return <DocumentPage doc={shippingDocument(useShopRules())} />;
}
