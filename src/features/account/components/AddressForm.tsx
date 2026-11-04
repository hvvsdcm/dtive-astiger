import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { embedPostcode, type SelectedAddress } from '@/lib/daumPostcode';
import { addressSchema, type AddressFormInput, type AddressInput } from '../schemas';

export type AddressFormProps = {
  defaultValues?: Partial<AddressFormInput>;
  onSubmit: (values: AddressInput) => void | Promise<void>;
  submitLabel: string;
  /** Shows a secondary "취소" button next to submit. */
  onCancel?: () => void;
};

const EMPTY: AddressFormInput = {
  label: '',
  recipient: '',
  phone: '',
  postalCode: '',
  address1: '',
  address2: '',
  isDefault: false,
};

/** Address fields with Kakao postcode search. Shared by the address book and checkout. */
export function AddressForm({ defaultValues, onSubmit, submitLabel, onCancel }: AddressFormProps) {
  const id = useId();
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormInput, unknown, AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  const onSelect = useCallback(
    (address: SelectedAddress) => {
      setValue('postalCode', address.postalCode, { shouldValidate: true });
      setValue('address1', address.address1, { shouldValidate: true });
      setSearchOpen(false);
      // Focus after the dialog has closed and returned focus to the search button.
      window.setTimeout(() => setFocus('address2'), 0);
    },
    [setValue, setFocus],
  );

  const addressError = errors.postalCode?.message ?? errors.address1?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field id={`${id}-label`} label="배송지명" error={errors.label?.message}>
        <Input
          id={`${id}-label`}
          invalid={Boolean(errors.label)}
          maxLength={20}
          {...register('label')}
        />
      </Field>
      <Field id={`${id}-recipient`} label="받는 분" required error={errors.recipient?.message}>
        <Input
          id={`${id}-recipient`}
          autoComplete="name"
          invalid={Boolean(errors.recipient)}
          maxLength={40}
          {...register('recipient')}
        />
      </Field>
      <Field id={`${id}-phone`} label="휴대폰 번호" required error={errors.phone?.message}>
        <Input
          id={`${id}-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="01012345678"
          invalid={Boolean(errors.phone)}
          {...register('phone')}
        />
      </Field>

      <Field id={`${id}-postal`} label="주소" required error={addressError}>
        <div className="flex gap-2">
          {/* Width on a wrapper: Input already carries w-full and cn() does not resolve conflicts. */}
          <div className="w-32 shrink-0">
            <Input
              id={`${id}-postal`}
              readOnly
              tabIndex={-1}
              placeholder="우편번호"
              invalid={Boolean(addressError)}
              onClick={() => setSearchOpen(true)}
              {...register('postalCode')}
            />
          </div>
          <Button variant="secondary" onClick={() => setSearchOpen(true)}>
            주소 검색
          </Button>
        </div>
        <Input
          readOnly
          tabIndex={-1}
          aria-label="기본 주소"
          invalid={Boolean(errors.address1)}
          onClick={() => setSearchOpen(true)}
          {...register('address1')}
        />
        <Input
          id={`${id}-address2`}
          aria-label="상세 주소"
          placeholder="상세 주소"
          autoComplete="address-line2"
          invalid={Boolean(errors.address2)}
          maxLength={120}
          {...register('address2')}
        />
        {errors.address2 ? <p className="text-xs text-danger">{errors.address2.message}</p> : null}
      </Field>

      <Checkbox id={`${id}-default`} label="기본 배송지로 저장" {...register('isDefault')} />

      <div className="flex gap-2 pt-2">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            취소
          </Button>
        ) : null}
        <Button type="submit" loading={isSubmitting} className="flex-1">
          {submitLabel}
        </Button>
      </div>

      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} title="주소 검색">
        {searchOpen ? <PostcodeSearch onSelect={onSelect} /> : null}
      </Dialog>
    </form>
  );
}

function PostcodeSearch({ onSelect }: { onSelect: (address: SelectedAddress) => void }) {
  const [failed, setFailed] = useState(false);
  const container = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      embedPostcode(element, onSelect).catch(() => setFailed(true));
    },
    [onSelect],
  );

  if (failed) {
    return <p className="py-12 text-center text-base">주소 검색을 불러오지 못했습니다</p>;
  }
  return <div ref={container} className="-mx-6 -my-6 h-[460px]" />;
}
