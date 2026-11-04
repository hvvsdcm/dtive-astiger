import { privacyDocument } from '@/content/privacy';
import { DocumentPage } from '../components/DocumentPage';

export function PrivacyPage() {
  return <DocumentPage doc={privacyDocument()} />;
}
