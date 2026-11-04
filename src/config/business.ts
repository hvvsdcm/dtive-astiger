/**
 * Business details shown in the footer, legal pages and PDP. This is the only file the operator
 * needs to fill in (docs/HANDOVER.md, "사업자 정보"). Empty strings are hidden in the footer and
 * rendered as "[사업자 정보 입력 필요]" on the legal pages (src/content).
 */
export const business = {
  brandName: 'DTIVE & ASTIGER',
  brandNameKo: '디티브 아시티거',
  /** 상호 */
  companyName: '',
  /** 대표자 */
  ceo: '',
  /** 사업자등록번호, e.g. '123-45-67890'. The footer links it to the FTC business lookup. */
  bizNo: '',
  /** 통신판매업 신고번호, e.g. '2026-서울강남-01234' */
  mailOrderNo: '',
  /** 사업장 주소 */
  address: '',
  phone: '',
  email: '',
  privacyOfficer: { name: '', email: '' },
  customerService: { hours: '평일 10:00–17:00', email: '' },
  social: { instagram: '' },
  /** 호스팅서비스 제공자 (footer, privacy policy). Cloudflare Workers; change it if the site moves. */
  hostingProvider: 'Cloudflare, Inc.',
  /** Supabase project region as shown to customers, e.g. '대한민국(서울)'. Privacy policy. */
  dataRegion: '',
  /** Custom SMTP provider that sends sign-up and password emails. Privacy policy. */
  mailService: { company: '', country: '' },
  /** Contracted courier, e.g. 'CJ대한통운'. Privacy policy and shipping page. */
  courier: '',
  /** Where customers send returns and exchanges. */
  returnAddress: '',
  /** Effective date of the terms and privacy policy, e.g. '2026-12-01'. */
  policyEffectiveDate: '',
  shippingPolicy:
    '주문 후 입금이 확인되면 영업일 기준 1–3일 내 출고됩니다. 제주·도서산간 지역은 추가 배송비가 발생할 수 있습니다.',
  returnPolicy:
    '상품 수령 후 7일 이내 교환·반품을 신청할 수 있습니다. 착용 흔적이 있거나 택을 제거한 상품은 교환·반품이 제한됩니다. 단순 변심에 의한 반품 배송비는 고객 부담입니다.',
};
