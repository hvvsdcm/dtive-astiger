import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router';
import { loginPath } from '@/app/guards';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Radio } from '@/components/ui/Radio';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { createAddress, useAddresses, useProfile, type Address } from '@/features/account/api';
import { AddressForm } from '@/features/account/components/AddressForm';
import type { AddressInput } from '@/features/account/schemas';
import { useSession } from '@/features/auth/session';
import { CartLine } from '@/features/cart/components/CartLine';
import { selectSubtotal, useCart } from '@/features/cart/store';
import { qk } from '@/lib/queryKeys';
import { rpcErrorCode, rpcErrorMessage } from '@/lib/rpcErrors';
import { createOrder, useSiteSettings } from '../api';
import { OrderSummary } from '../components/OrderSummary';
import { shippingFeeFor } from '../pricing';
import { BLOCKING_NOTICES } from '../reconcile';
import type { CheckoutLoaderData } from '../routes';
import { checkoutSchema, type CheckoutFormInput, type CheckoutValues } from '../schemas';

type Selection =
  | { kind: 'saved'; id: string }
  /** `address` null while the new-address form is open. */
  | { kind: 'new'; address: AddressInput | null };

const formatPhone = (phone: string) => phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');

export function CheckoutPage() {
  const id = useId();
  const formId = `${id}-form`;
  const { notices } = useLoaderData<CheckoutLoaderData>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const lines = useCart((state) => state.lines);
  const subtotal = useCart(selectSubtotal);
  const addresses = useAddresses();
  const profile = useProfile();
  const settings = useSiteSettings();
  const [picked, setPicked] = useState<Selection | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormInput, unknown, CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      memo: '',
      depositorName: (profile.data?.name ?? '').slice(0, 20),
      agree: false as unknown as true,
    },
  });

  const saved = addresses.data ?? [];
  const fallbackAddress = saved.find((address) => address.is_default) ?? saved[0];
  // Until the user picks, the default address (or a new address when the book is empty).
  const selection: Selection | null =
    picked ??
    (addresses.isPending
      ? null
      : fallbackAddress
        ? { kind: 'saved', id: fallbackAddress.id }
        : { kind: 'new', address: null });

  const select = (next: Selection) => {
    setPicked(next);
    clearErrors('shipping');
  };

  const blocked = lines.some((line) =>
    notices[line.variantId]?.some((notice) => BLOCKING_NOTICES.includes(notice)),
  );
  const fee = settings.data ? shippingFeeFor(subtotal, settings.data) : null;

  async function saveNewAddress(values: AddressInput) {
    if (!values.isDefault || !user) {
      select({ kind: 'new', address: values });
      return;
    }
    // "기본 배송지로 저장" also stores it in the address book.
    try {
      const created = await createAddress(user.id, values, saved.length === 0);
      await queryClient.invalidateQueries({ queryKey: qk.addresses(user.id) });
      select({ kind: 'saved', id: created.id });
    } catch (error) {
      toast(rpcErrorMessage(error), 'error');
    }
  }

  async function place(values: CheckoutValues) {
    if (submittingRef.current || blocked || !user) return;
    const { shipping } = values;
    const address =
      'addressId' in shipping ? saved.find((a) => a.id === shipping.addressId) : shipping;
    if (!address) {
      setSubmitError('배송지를 선택하세요');
      return;
    }
    submittingRef.current = true;
    setSubmitError(null);
    try {
      const result = await createOrder({
        items: lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
        address: {
          recipient: address.recipient,
          phone: address.phone,
          postal_code: 'postal_code' in address ? address.postal_code : address.postalCode,
          address1: address.address1,
          address2: address.address2,
        },
        memo: values.memo,
        depositor_name: values.depositorName,
      });
      void queryClient.invalidateQueries({ queryKey: qk.orders(user.id) });
      void queryClient.invalidateQueries({ queryKey: qk.products() });
      lines.forEach(
        (line) => void queryClient.invalidateQueries({ queryKey: qk.product(line.slug) }),
      );
      // Leave the page first so the emptied cart never renders here.
      await navigate(`/orders/${result.order_id}/complete`, { replace: true });
      useCart.getState().clear();
    } catch (error) {
      submittingRef.current = false;
      const code = rpcErrorCode(error);
      if (code === 'AUTH_REQUIRED') {
        toast(rpcErrorMessage(error), 'error');
        void navigate(loginPath('/checkout'));
        return;
      }
      setSubmitError(rpcErrorMessage(error));
      // Stock or availability changed: re-run the loader to mark the affected lines.
      if (code === 'OUT_OF_STOCK' || code === 'ITEM_UNAVAILABLE') void revalidator.revalidate();
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // The address picker lives outside this form; its choice is validated with the rest here.
    // undefined (nothing chosen) is not a valid input type, which is what the schema reports.
    const shipping = (
      selection?.kind === 'saved' ? { addressId: selection.id } : (selection?.address ?? undefined)
    ) as CheckoutFormInput['shipping'];
    setValue('shipping', shipping);
    return handleSubmit(place)(event);
  };

  if (lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-gutter">
        <title>{pageTitle('주문서')}</title>
        <EmptyState
          title="장바구니가 비어 있습니다"
          action={{ label: '쇼핑 계속하기', to: '/shop' }}
        />
      </div>
    );
  }

  const shippingError = errors.shipping?.message;

  return (
    <div className="mx-auto w-full max-w-[960px] px-gutter py-12 lg:py-16">
      <title>{pageTitle('주문서')}</title>
      <h1 className="mb-8 text-lg font-medium">주문서</h1>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby={`${id}-shipping`} className="flex flex-col gap-4">
            <h2 id={`${id}-shipping`} className="border-b border-ink pb-3 text-md font-medium">
              배송지
            </h2>
            {selection === null ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <ShippingPicker
                name={`${id}-address`}
                saved={saved}
                selection={selection}
                onSelect={select}
                onSaveNew={saveNewAddress}
              />
            )}
            {shippingError ? (
              <p role="alert" className="text-xs text-danger">
                {shippingError}
              </p>
            ) : null}
          </section>

          <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-12">
            <section aria-labelledby={`${id}-payment`} className="flex flex-col gap-5">
              <h2 id={`${id}-payment`} className="border-b border-ink pb-3 text-md font-medium">
                결제
              </h2>
              <p className="text-base">무통장입금</p>
              <Field
                id={`${id}-depositor`}
                label="입금자명"
                required
                error={errors.depositorName?.message}
              >
                <Input
                  id={`${id}-depositor`}
                  maxLength={20}
                  autoComplete="name"
                  invalid={Boolean(errors.depositorName)}
                  {...register('depositorName')}
                />
              </Field>
              <Field id={`${id}-memo`} label="배송 메모" error={errors.memo?.message}>
                <Input
                  id={`${id}-memo`}
                  maxLength={200}
                  invalid={Boolean(errors.memo)}
                  {...register('memo')}
                />
              </Field>
            </section>
          </form>
        </div>

        <aside
          aria-labelledby={`${id}-items`}
          className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start"
        >
          <h2 id={`${id}-items`} className="border-b border-ink pb-3 text-md font-medium">
            주문 상품
          </h2>
          <ul className="-mt-4 divide-y divide-line border-b border-line">
            {lines.map((line) => (
              <CartLine
                key={line.variantId}
                line={line}
                mode="checkout"
                notices={notices[line.variantId]}
              />
            ))}
          </ul>
          <OrderSummary subtotal={subtotal} shippingFee={fee} />
          <div className="flex flex-col gap-2">
            <Checkbox
              id={`${id}-agree`}
              form={formId}
              label="주문 내용을 확인했으며 구매에 동의합니다"
              invalid={Boolean(errors.agree)}
              {...register('agree')}
            />
            {errors.agree ? (
              <p id={`${id}-agree-error`} role="alert" className="text-xs text-danger">
                {errors.agree.message}
              </p>
            ) : null}
          </div>
          {submitError ? (
            <p role="alert" className="text-sm text-danger">
              {submitError}
            </p>
          ) : null}
          <Button
            type="submit"
            form={formId}
            fullWidth
            loading={isSubmitting}
            disabled={blocked || revalidator.state === 'loading'}
          >
            주문하기
          </Button>
        </aside>
      </div>
    </div>
  );
}

function ShippingPicker({
  name,
  saved,
  selection,
  onSelect,
  onSaveNew,
}: {
  name: string;
  saved: Address[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onSaveNew: (values: AddressInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AddressInput | null>(null);
  const newAddress = selection.kind === 'new' ? selection.address : null;
  const editingNew = selection.kind === 'new' && selection.address === null;
  const first = saved[0];

  return (
    <div className="flex flex-col gap-4">
      {saved.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {saved.map((address) => (
            <li key={address.id}>
              <Radio
                id={`${name}-${address.id}`}
                name={name}
                checked={selection.kind === 'saved' && selection.id === address.id}
                onChange={() => onSelect({ kind: 'saved', id: address.id })}
                label={
                  <span className="flex flex-col gap-1 text-base">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{address.label || address.recipient}</span>
                      {address.is_default ? <Badge tone="ink">기본</Badge> : null}
                    </span>
                    {address.label ? <span>{address.recipient}</span> : null}
                    <span className="text-ink-muted">{formatPhone(address.phone)}</span>
                    <span className="break-words text-ink-muted">
                      ({address.postal_code}) {address.address1} {address.address2}
                    </span>
                  </span>
                }
              />
            </li>
          ))}
          <li>
            <Radio
              id={`${name}-new`}
              name={name}
              checked={selection.kind === 'new'}
              onChange={() => onSelect({ kind: 'new', address: draft })}
              label={<span className="text-base">새 주소</span>}
            />
          </li>
        </ul>
      ) : null}

      {editingNew ? (
        <div className={saved.length > 0 ? 'border-t border-line pt-6' : undefined}>
          <AddressForm
            defaultValues={draft ?? undefined}
            submitLabel="이 주소로 배송"
            onSubmit={async (values) => {
              setDraft(values);
              await onSaveNew(values);
            }}
            onCancel={first ? () => onSelect({ kind: 'saved', id: first.id }) : undefined}
          />
        </div>
      ) : null}

      {newAddress ? (
        <div className="flex items-start justify-between gap-4 border border-line p-4">
          <div className="flex min-w-0 flex-col gap-1 text-base">
            <span className="font-medium">{newAddress.recipient}</span>
            <span className="text-ink-muted">{formatPhone(newAddress.phone)}</span>
            <span className="break-words text-ink-muted">
              ({newAddress.postalCode}) {newAddress.address1} {newAddress.address2}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect({ kind: 'new', address: null })}
          >
            수정
          </Button>
        </div>
      ) : null}
    </div>
  );
}
