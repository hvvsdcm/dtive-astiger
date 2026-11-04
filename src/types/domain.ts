import { Constants, type Database } from './database';

/**
 * Domain enums from the generated database types (supabase/migrations 0002_types.sql) and the
 * order state machine (docs/PLAN.md 6.5). The server is the source of truth; these drive labels and
 * which actions the UI offers.
 */

type Enums = Database['public']['Enums'];

export type OrderStatus = Enums['order_status'];
export const ORDER_STATUSES: readonly OrderStatus[] = Constants.public.Enums.order_status;

export type ProductStatus = Enums['product_status'];
export const PRODUCT_STATUSES: readonly ProductStatus[] = Constants.public.Enums.product_status;

export type HomeSectionKind = Enums['home_section_kind'];
export const HOME_SECTION_KINDS: readonly HomeSectionKind[] =
  Constants.public.Enums.home_section_kind;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: '입금 대기',
  paid: '입금 확인',
  preparing: '상품 준비중',
  shipped: '배송중',
  delivered: '배송 완료',
  cancelled: '취소',
  refunded: '환불 완료',
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  draft: '임시저장',
  active: '판매중',
  archived: '보관',
};

/**
 * Allowed admin/customer transitions. `cancelled → refunded` is only valid when the order had been
 * paid (`paid_at` set); callers must check that before offering it.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['preparing', 'shipped', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: ['refunded'],
  refunded: [],
};

export type Carrier = {
  code: string;
  name: string;
  trackUrl: (trackingNo: string) => string;
};

export const CARRIERS = [
  {
    code: 'cj',
    name: 'CJ대한통운',
    trackUrl: (no: string) =>
      `https://trace.cjlogistics.com/next/tracking.html?wblNo=${encodeURIComponent(no)}`,
  },
  {
    code: 'lotte',
    name: '롯데택배',
    trackUrl: (no: string) =>
      `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${encodeURIComponent(no)}`,
  },
  {
    code: 'hanjin',
    name: '한진택배',
    trackUrl: (no: string) =>
      `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(no)}`,
  },
  {
    code: 'post',
    name: '우체국택배',
    trackUrl: (no: string) =>
      `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(no)}`,
  },
  {
    code: 'logen',
    name: '로젠택배',
    trackUrl: (no: string) => `https://www.ilogen.com/web/personal/trace/${encodeURIComponent(no)}`,
  },
] as const satisfies readonly Carrier[];

export type CarrierCode = (typeof CARRIERS)[number]['code'];
