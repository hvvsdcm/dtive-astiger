import { business } from '@/config/business';
import { CS_EMAIL, filled, shippingFeeSentence } from './shared';
import type { LegalDocument, ShopRules } from './types';

/** 배송·교환·반품 안내. The lead paragraphs reuse business.shippingPolicy / returnPolicy (PDP). */
export function shippingDocument(rules: ShopRules): LegalDocument {
  return {
    title: '배송·교환·반품',
    sections: [
      {
        id: 'delivery',
        title: '배송',
        blocks: [
          business.shippingPolicy,
          {
            list: [
              `택배사: ${filled(business.courier)}`,
              '배송 지역: 대한민국 전 지역(해외 배송 없음)',
              shippingFeeSentence(rules),
              '여러 상품을 함께 주문하면 한 번에 발송합니다.',
              '발송 후 마이페이지 주문 상세에서 송장번호와 배송 조회 링크를 확인할 수 있습니다.',
            ],
          },
        ],
      },
      {
        id: 'returns',
        title: '교환·반품',
        blocks: [
          business.returnPolicy,
          {
            list: [
              `신청: 상품을 받은 날부터 7일 이내에 고객센터(${CS_EMAIL})로 주문번호, 상품, 사유를 보내 주세요.`,
              `보내실 곳: ${filled(business.returnAddress)}`,
              '단순 변심: 반품 배송비는 고객 부담이며, 무료배송으로 받은 경우 왕복 배송비가 부과됩니다.',
              '상품 불량·오배송: 배송비는 회사가 부담합니다. 상품을 받은 날부터 3개월 이내, 그 사실을 안 날부터 30일 이내에 신청할 수 있습니다.',
              '교환은 같은 상품의 다른 색상·사이즈로만 가능하며, 재고가 없으면 반품으로 처리합니다.',
            ],
          },
        ],
      },
      {
        id: 'restrictions',
        title: '교환·반품이 제한되는 경우',
        blocks: [
          {
            list: [
              '착용, 세탁, 수선 흔적이 있거나 향수·화장품 등으로 오염된 상품',
              '택이나 라벨을 제거했거나 상품 포장·구성품이 훼손된 상품',
              '고객의 부주의로 멸실·훼손된 상품',
              '상품을 받은 날부터 7일이 지난 상품',
            ],
          },
        ],
      },
      {
        id: 'refunds',
        title: '환불',
        blocks: [
          {
            list: [
              '입금 전 취소: 결제된 금액이 없으므로 환불 절차가 없습니다.',
              '입금 후 발송 전 취소: 취소가 확정된 날부터 3영업일 이내에 환불합니다.',
              '반품: 반품 상품이 도착한 날부터 3영업일 이내에 환불합니다.',
              '환불은 알려 주신 본인 명의 계좌로 이체하며, 반품 배송비가 있으면 차감합니다.',
            ],
          },
        ],
      },
    ],
  };
}
