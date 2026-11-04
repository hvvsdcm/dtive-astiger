const RPC_ERROR_MESSAGES = {
  AUTH_REQUIRED: '로그인이 필요합니다',
  OUT_OF_STOCK: '재고가 부족한 상품이 있습니다',
  ITEM_UNAVAILABLE: '판매 중이 아닌 상품이 있습니다',
  BANK_NOT_CONFIGURED: '현재 주문을 받을 수 없습니다',
  TOO_MANY_PENDING: '입금 대기 주문이 3건 있어 더 주문할 수 없습니다',
  TOO_MANY_ORDERS: '주문이 너무 많습니다. 잠시 후 다시 시도하세요',
  CANNOT_CANCEL: '취소할 수 없는 주문입니다',
  ACTIVE_ORDERS: '진행 중인 주문이 있어 탈퇴할 수 없습니다',
  FORBIDDEN: '권한이 없습니다',
  INVALID_INPUT: '입력값을 확인하세요',
  INVALID_TRANSITION: '현재 상태에서 할 수 없는 작업입니다',
  STOCK_CHANGED: '그사이 재고가 바뀌었습니다',
} as const;

export type RpcErrorCode = keyof typeof RPC_ERROR_MESSAGES;

export const FALLBACK_ERROR_MESSAGE = '요청을 처리하지 못했습니다';

type ErrorLike = { message?: unknown; details?: unknown; code?: unknown };

export function rpcErrorCode(error: unknown): RpcErrorCode | null {
  const message = (error as ErrorLike | null)?.message;
  return typeof message === 'string' && Object.hasOwn(RPC_ERROR_MESSAGES, message)
    ? (message as RpcErrorCode)
    : null;
}

/**
 * User-facing Korean message for a Supabase RPC/PostgREST error. Known server codes (raised as
 * `message`) map to fixed text; anything else gets a generic message so raw SQL errors never
 * reach the screen.
 */
export function rpcErrorMessage(error: unknown): string {
  const code = rpcErrorCode(error);
  return code ? RPC_ERROR_MESSAGES[code] : FALLBACK_ERROR_MESSAGE;
}

/** The `detail` the server attached (e.g. the variant_id for OUT_OF_STOCK), or null. */
export function rpcErrorDetail(error: unknown): string | null {
  const details = (error as ErrorLike | null)?.details;
  return typeof details === 'string' && details !== '' ? details : null;
}
