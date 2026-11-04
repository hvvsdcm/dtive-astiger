import { describe, expect, it } from 'vitest';
import { faqGroups } from './faq';
import { privacyDocument } from './privacy';
import { MISSING, shippingFeeSentence } from './shared';
import { shippingDocument } from './shipping';
import { termsDocument } from './terms';
import type { LegalDocument, ShopRules } from './types';

const rules: NonNullable<ShopRules> = {
  shippingFee: 3000,
  freeShippingThreshold: 100000,
  paymentDueHours: 48,
};
const text = (doc: LegalDocument) => JSON.stringify(doc.sections);

describe('legal content', () => {
  it('quotes site_settings values when they are known', () => {
    const terms = text(termsDocument(rules));
    expect(terms).toContain('주문 후 48시간');
    expect(terms).toContain('배송비는 3,000원이며, 상품 금액 100,000원 이상 주문은 무료입니다.');
    expect(JSON.stringify(faqGroups(rules))).toContain('주문 후 48시간');
  });

  it('falls back to wording without numbers', () => {
    const terms = text(termsDocument(null));
    expect(terms).toContain('주문 완료 화면에 안내된 기한');
    expect(terms).not.toMatch(/\d+시간/);
    expect(text(shippingDocument(null))).toContain('배송비는 주문서에 표시됩니다.');
  });

  it('marks empty business details', () => {
    // business.ts ships with empty company details.
    expect(text(termsDocument(rules))).toContain(MISSING);
    expect(text(privacyDocument())).toContain(MISSING);
  });

  it('numbers the terms articles and keeps anchors unique', () => {
    const docs = [termsDocument(rules), privacyDocument(), shippingDocument(rules)];
    for (const doc of docs) {
      const ids = doc.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(termsDocument(rules).sections[14]?.title).toBe('제15조 청약철회 등');
    const faqIds = faqGroups(rules).map((group) => group.id);
    expect(new Set(faqIds).size).toBe(faqIds.length);
  });
});

describe('shippingFeeSentence', () => {
  it('covers free, flat and threshold fees', () => {
    expect(shippingFeeSentence({ ...rules, shippingFee: 0 })).toBe('배송비는 무료입니다.');
    expect(shippingFeeSentence({ ...rules, freeShippingThreshold: null })).toBe(
      '배송비는 3,000원입니다.',
    );
  });
});
