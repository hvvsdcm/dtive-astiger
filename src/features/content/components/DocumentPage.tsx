import type { LegalDocument } from '@/content/types';
import { Blocks, TextPage, TextSection } from './TextPage';

export function DocumentPage({ doc }: { doc: LegalDocument }) {
  return (
    <TextPage title={doc.title} effectiveDate={doc.effectiveDate} toc={doc.sections}>
      {doc.sections.map((section) => (
        <TextSection key={section.id} id={section.id} title={section.title}>
          <Blocks blocks={section.blocks} />
        </TextSection>
      ))}
    </TextPage>
  );
}
