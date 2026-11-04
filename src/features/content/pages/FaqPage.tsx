import { Accordion } from '@/components/ui/Accordion';
import { faqGroups } from '@/content/faq';
import { Rich, TextPage, TextSection } from '../components/TextPage';
import { useShopRules } from '../useShopRules';

export function FaqPage() {
  const groups = faqGroups(useShopRules());
  return (
    <TextPage title="FAQ" toc={groups}>
      {groups.map((group) => (
        <TextSection key={group.id} id={group.id} title={group.title}>
          <Accordion
            items={group.items.map((item, index) => ({
              id: String(index),
              title: item.q,
              content: <Rich text={item.a} />,
            }))}
          />
        </TextSection>
      ))}
    </TextPage>
  );
}
