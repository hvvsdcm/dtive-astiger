import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { settingsQuery, type SiteSettings } from '@/features/checkout/api';
import { formatDateTime } from '@/lib/format';
import { qk } from '@/lib/queryKeys';
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from '@/types/domain';
import {
  ADMIN_PAGE_SIZE,
  AUDIT_TABLES,
  adminErrorMessage,
  fetchAuditLogs,
  saveSettings,
  type AuditEntry,
  type AuditFilters,
  type AuditTable,
} from '../api';
import { DataTable } from '../components/DataTable';
import { settingsSchema, type SettingsFormInput, type SettingsValues } from '../schemas';

export function SettingsPage() {
  const settings = useQuery(settingsQuery);

  return (
    <>
      <title>{pageTitle('설정')}</title>
      <h1 className="mb-6 text-lg font-medium">설정</h1>
      {settings.isPending ? (
        <div className="flex max-w-[720px] flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {settings.data ? <SettingsForm key={settings.data.updated_at} row={settings.data} /> : null}
      <AuditLog />
    </>
  );
}

function SettingsForm({ row }: { row: SiteSettings }) {
  const id = useId();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormInput, unknown, SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      shippingFee: String(row.shipping_fee),
      freeShippingThreshold:
        row.free_shipping_threshold === null ? '' : String(row.free_shipping_threshold),
      bankName: row.bank_name,
      bankAccount: row.bank_account,
      bankHolder: row.bank_holder,
      paymentDueHours: String(row.payment_due_hours),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveSettings(values);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.settings }),
        queryClient.invalidateQueries({ queryKey: qk.admin.audit }),
      ]);
      toast('저장했습니다');
    } catch (error) {
      toast(adminErrorMessage(error), 'error');
    }
  });

  const field = (name: keyof SettingsFormInput) => ({
    id: `${id}-${name}`,
    invalid: Boolean(errors[name]),
    ...register(name),
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="flex max-w-[720px] flex-col gap-10"
    >
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-5 w-full border-b border-ink pb-3 text-sm font-medium">
          입금 계좌
        </legend>
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <Field id={`${id}-bankName`} label="은행" required error={errors.bankName?.message}>
            <Input autoComplete="off" {...field('bankName')} />
          </Field>
          <Field
            id={`${id}-bankAccount`}
            label="계좌번호"
            required
            error={errors.bankAccount?.message}
          >
            <Input inputMode="numeric" autoComplete="off" {...field('bankAccount')} />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id={`${id}-bankHolder`} label="예금주" required error={errors.bankHolder?.message}>
            <Input autoComplete="off" {...field('bankHolder')} />
          </Field>
          <Field
            id={`${id}-paymentDueHours`}
            label="입금 기한 (시간)"
            required
            error={errors.paymentDueHours?.message}
          >
            <Input inputMode="numeric" {...field('paymentDueHours')} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-5 w-full border-b border-ink pb-3 text-sm font-medium">배송비</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id={`${id}-shippingFee`}
            label="배송비 (원)"
            required
            error={errors.shippingFee?.message}
          >
            <Input inputMode="numeric" {...field('shippingFee')} />
          </Field>
          <Field
            id={`${id}-freeShippingThreshold`}
            label="무료배송 기준 (원, 비우면 없음)"
            error={errors.freeShippingThreshold?.message}
          >
            <Input inputMode="numeric" {...field('freeShippingThreshold')} />
          </Field>
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          저장
        </Button>
        <span className="text-xs text-ink-muted tabular-nums">
          최근 수정 {formatDateTime(row.updated_at)}
        </span>
      </div>
    </form>
  );
}

// Audit log ---------------------------------------------------------------------------------------

const TABLE_LABEL: Record<AuditTable, string> = {
  orders: '주문',
  products: '상품',
  product_variants: '상품 옵션',
  product_images: '상품 이미지',
  categories: '카테고리',
  home_sections: '홈 섹션',
  site_settings: '설정',
  profiles: '회원',
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: '추가',
  UPDATE: '수정',
  DELETE: '삭제',
  ACCOUNT_DELETED: '탈퇴',
};

const FIELD_LABEL: Record<string, string> = {
  status: '상태',
  admin_note: '관리자 메모',
  carrier: '택배사',
  tracking_no: '송장번호',
  cancel_reason: '취소 사유',
  bank_name: '은행',
  bank_account: '계좌번호',
  bank_holder: '예금주',
  payment_due_hours: '입금 기한',
  shipping_fee: '배송비',
  free_shipping_threshold: '무료배송 기준',
  name: '이름',
  slug: '슬러그',
  price: '가격',
  compare_at_price: '정가',
  stock: '재고',
  sku: 'SKU',
  is_active: '활성',
  is_featured: '추천',
  sort: '순서',
  title: '제목',
  link_label: '링크 문구',
  link_href: '링크',
  image_path: '이미지',
  image_path_2: '이미지 2',
  items: '룩북 이미지',
  product_ids: '상품',
  category_id: '카테고리',
  parent_id: '상위 카테고리',
  description: '설명',
};

/** Bookkeeping columns that change on every write and say nothing about the edit. */
const IGNORED_FIELDS = new Set(['updated_at', 'updated_by']);

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '없음';
  if (key === 'status' && ORDER_STATUSES.includes(value as OrderStatus)) {
    return ORDER_STATUS_LABEL[value as OrderStatus];
  }
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return `${value.length}개`;
  if (typeof value === 'object') return '변경';
  const text = String(value);
  return text.length > 32 ? `${text.slice(0, 32)}…` : text;
}

/** Name of the changed record: order number, product/category name, SKU, section title. */
function targetName(entry: AuditEntry): string {
  if (entry.table_name === 'site_settings') return '사이트 설정';
  const row = asObject(entry.after) ?? asObject(entry.before);
  if (!row) return '';
  for (const key of ['order_no', 'name', 'sku', 'title']) {
    const value = row[key];
    if (typeof value === 'string' && value) return value;
  }
  if (typeof row.kind === 'string') return row.kind;
  return '';
}

/**
 * "field: before → after" for an update, timestamps left out when anything else changed. Order rows
 * are logged without personal/free-text fields; `redacted_changed` lists the ones that changed.
 */
function changes(entry: AuditEntry): string[] {
  if (entry.action !== 'UPDATE') return [];
  const before = asObject(entry.before) ?? {};
  const { redacted_changed: redacted, ...after } = asObject(entry.after) ?? {};
  const keys = Object.keys(after).filter(
    (key) => !IGNORED_FIELDS.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  const meaningful = keys.filter((key) => !key.endsWith('_at'));
  const hidden = Array.isArray(redacted)
    ? redacted.map((key) => `${FIELD_LABEL[String(key)] ?? String(key)} 변경`)
    : [];
  return [
    ...(meaningful.length || hidden.length ? meaningful : keys).map(
      (key) =>
        `${FIELD_LABEL[key] ?? key}: ${formatValue(key, before[key])} → ${formatValue(key, after[key])}`,
    ),
    ...hidden,
  ];
}

function AuditLog() {
  const id = useId();
  const [filters, setFilters] = useState<AuditFilters>({ table: 'all', page: 1 });
  const logs = useQuery({
    queryKey: [...qk.admin.audit, filters],
    queryFn: () => fetchAuditLogs(filters),
    placeholderData: keepPreviousData,
  });
  const pageCount = Math.ceil((logs.data?.total ?? 0) / ADMIN_PAGE_SIZE);

  return (
    <section aria-labelledby={`${id}-title`} className="mt-16">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id={`${id}-title`} className="text-md font-medium">
          변경 기록
        </h2>
        <Select
          aria-label="대상"
          value={filters.table}
          onChange={(event) =>
            setFilters({ table: event.target.value as AuditFilters['table'], page: 1 })
          }
          className="w-40"
        >
          <option value="all">전체</option>
          {AUDIT_TABLES.map((table) => (
            <option key={table} value={table}>
              {TABLE_LABEL[table]}
            </option>
          ))}
        </Select>
      </div>
      <DataTable<AuditEntry>
        label="변경 기록"
        rows={logs.data?.items}
        rowKey={(row) => String(row.id)}
        loading={logs.isPending}
        error={logs.isError}
        onRetry={() => void logs.refetch()}
        columns={[
          {
            key: 'time',
            header: '일시',
            className: 'w-36 tabular-nums text-ink-muted whitespace-nowrap',
            cell: (row) => formatDateTime(row.created_at),
          },
          {
            key: 'actor',
            header: '작업자',
            className: 'min-w-40',
            cell: (row) =>
              row.actorEmail ?? (
                <span className="text-ink-muted">{row.actor_id ? '삭제된 계정' : '시스템'}</span>
              ),
          },
          {
            key: 'target',
            header: '대상',
            className: 'min-w-40',
            cell: (row) => (
              <span className="flex flex-col">
                <span>
                  {TABLE_LABEL[row.table_name as AuditTable] ?? row.table_name} ·{' '}
                  {ACTION_LABEL[row.action] ?? row.action}
                </span>
                <span className="text-2xs break-all text-ink-muted">{targetName(row)}</span>
              </span>
            ),
          },
          {
            key: 'changes',
            header: '내용',
            className: 'min-w-64',
            cell: (row) => {
              const lines = changes(row);
              if (lines.length === 0) return <span className="text-ink-muted">—</span>;
              return (
                <ul className="flex flex-col gap-0.5 text-xs">
                  {lines.slice(0, 4).map((line) => (
                    <li key={line} className="break-words">
                      {line}
                    </li>
                  ))}
                  {lines.length > 4 ? (
                    <li className="text-ink-muted">외 {lines.length - 4}개</li>
                  ) : null}
                </ul>
              );
            },
          },
        ]}
      />
      <Pagination
        page={filters.page}
        pageCount={pageCount}
        onChange={(page) => setFilters((f) => ({ ...f, page }))}
        className="mt-6"
      />
    </section>
  );
}
