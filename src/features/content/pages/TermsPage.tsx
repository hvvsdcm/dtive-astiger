import { termsDocument } from '@/content/terms';
import { DocumentPage } from '../components/DocumentPage';
import { useShopRules } from '../useShopRules';

export function TermsPage() {
  return <DocumentPage doc={termsDocument(useShopRules())} />;
}
