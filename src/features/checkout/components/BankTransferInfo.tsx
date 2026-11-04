import { Copy } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/components/ui/toastStore';
import { formatDateTime, formatKRW } from '@/lib/format';
import type { Order } from '../api';

export type BankTransferInfoProps = {
  order: Pick<
    Order,
    'bank_name' | 'bank_account' | 'bank_holder' | 'total' | 'payment_due_at' | 'depositor_name'
  >;
};

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast('복사했습니다');
  } catch {
    toast('복사하지 못했습니다', 'error');
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      aria-label={`${label} 복사`}
      className="-my-2 inline-flex size-9 shrink-0 items-center justify-center text-ink-muted hover:text-ink"
    >
      <Icon icon={Copy} size={16} />
    </button>
  );
}

/** Bank account snapshot taken when the order was placed, amount and deadline. */
export function BankTransferInfo({ order }: BankTransferInfoProps) {
  const rows = [
    { term: '은행', value: order.bank_name },
    { term: '계좌번호', value: order.bank_account, copy: order.bank_account.replace(/\D/g, '') },
    { term: '예금주', value: order.bank_holder },
    { term: '입금 금액', value: formatKRW(order.total), copy: String(order.total), strong: true },
    { term: '입금 기한', value: `${formatDateTime(order.payment_due_at)}까지` },
    { term: '입금자명', value: order.depositor_name },
  ];
  return (
    <dl className="flex flex-col gap-3 border border-line bg-surface p-4 text-base lg:p-6">
      {rows.map((row) => (
        <div key={row.term} className="flex items-center gap-4">
          <dt className="w-20 shrink-0 text-ink-muted">{row.term}</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-1">
            <span className={row.strong ? 'font-semibold tabular-nums' : 'break-all tabular-nums'}>
              {row.value}
            </span>
            {row.copy ? <CopyButton text={row.copy} label={row.term} /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
