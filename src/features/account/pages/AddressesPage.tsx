import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { useSession } from '@/features/auth/session';
import { qk } from '@/lib/queryKeys';
import { rpcErrorMessage } from '@/lib/rpcErrors';
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  toAddressFormInput,
  updateAddress,
  useAddresses,
  type Address,
} from '../api';
import { AddressForm } from '../components/AddressForm';
import type { AddressInput } from '../schemas';

/** 01012345678 → 010-1234-5678 */
function formatPhone(phone: string): string {
  return phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
}

type Editing = { mode: 'create' } | { mode: 'edit'; address: Address } | null;

export function AddressesPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const addresses = useAddresses();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.addresses(user?.id) });
  const onError = (error: unknown) => toast(rpcErrorMessage(error), 'error');

  const setDefault = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () => invalidate(),
    onError,
  });
  const remove = useMutation({
    mutationFn: deleteAddress,
    onSuccess: async () => {
      await invalidate();
      setDeleting(null);
      toast('삭제했습니다');
    },
    onError,
  });

  async function save(values: AddressInput) {
    if (!user || !editing) return;
    try {
      if (editing.mode === 'create') {
        await createAddress(user.id, values, (addresses.data?.length ?? 0) === 0);
      } else {
        await updateAddress(editing.address.id, values);
      }
      await invalidate();
      setEditing(null);
      toast('저장했습니다');
    } catch (error) {
      onError(error);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <title>{pageTitle('주소록')}</title>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-md font-medium">주소록</h2>
        {addresses.data && addresses.data.length > 0 ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing({ mode: 'create' })}>
            주소 추가
          </Button>
        ) : null}
      </div>

      {addresses.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : addresses.isError ? (
        <ErrorState onRetry={() => void addresses.refetch()} />
      ) : addresses.data.length === 0 ? (
        <EmptyState
          title="저장된 주소가 없습니다"
          action={{ label: '주소 추가', onClick: () => setEditing({ mode: 'create' }) }}
        />
      ) : (
        <ul className="border-t border-line">
          {addresses.data.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-4 border-b border-line py-5 sm:flex-row sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1 text-base">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{address.label || address.recipient}</span>
                  {address.is_default ? <Badge tone="ink">기본</Badge> : null}
                </div>
                {address.label ? <span>{address.recipient}</span> : null}
                <span className="text-ink-muted">{formatPhone(address.phone)}</span>
                <span className="break-words text-ink-muted">
                  ({address.postal_code}) {address.address1} {address.address2}
                </span>
              </div>
              <div className="flex shrink-0 items-start gap-4">
                {address.is_default ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setDefault.isPending}
                    onClick={() => setDefault.mutate(address.id)}
                  >
                    기본 배송지로
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing({ mode: 'edit', address })}
                >
                  수정
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(address)}>
                  삭제
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? '주소 수정' : '주소 추가'}
      >
        {editing ? (
          <AddressForm
            key={editing.mode === 'edit' ? editing.address.id : 'new'}
            defaultValues={
              editing.mode === 'edit' ? toAddressFormInput(editing.address) : undefined
            }
            submitLabel="저장"
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="주소 삭제"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button
              size="sm"
              loading={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              삭제
            </Button>
          </>
        }
      >
        <p>이 주소를 삭제할까요?</p>
      </Dialog>
    </section>
  );
}
