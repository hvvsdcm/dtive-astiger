/**
 * Business details shown in the footer, legal pages and PDP. This is the only file the operator
 * needs to fill in. Empty strings are hidden in the footer and rendered as
 * "[사업자 정보 입력 필요]" on legal pages.
 */
export const business = {
  brandName: 'DTIVE & ASTIGER',
  brandNameKo: '디티브 아시티거',
  companyName: '',
  ceo: '',
  bizNo: '',
  mailOrderNo: '',
  address: '',
  phone: '',
  email: '',
  privacyOfficer: { name: '', email: '' },
  customerService: { hours: '평일 10:00–17:00', email: '' },
  social: { instagram: '' },
  shippingPolicy:
    '주문 후 입금이 확인되면 영업일 기준 1–3일 내 출고됩니다. 제주·도서산간 지역은 추가 배송비가 발생할 수 있습니다.',
  returnPolicy:
    '상품 수령 후 7일 이내 교환·반품을 신청할 수 있습니다. 착용 흔적이 있거나 택을 제거한 상품은 교환·반품이 제한됩니다. 단순 변심에 의한 반품 배송비는 고객 부담입니다.',
} as const;
