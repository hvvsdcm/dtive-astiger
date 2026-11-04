import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { authErrorMessage, updatePassword } from '@/features/auth/api';
import { FormError } from '@/features/auth/components/AuthShell';
import { PASSWORD_RULE } from '@/features/auth/schemas';
import { useSession } from '@/features/auth/session';
import { qk } from '@/lib/queryKeys';
import { rpcErrorCode, rpcErrorMessage } from '@/lib/rpcErrors';
import {
  changeEmail,
  deleteMyAccount,
  updateProfile,
  useActiveOrderCount,
  useProfile,
  verifyPassword,
  type Profile,
} from '../api';
import { useAccountOutlet } from '../outlet';
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  profileSchema,
  type ChangeEmailValues,
  type ChangePasswordValues,
  type DeleteAccountValues,
  type ProfileFormInput,
  type ProfileValues,
} from '../schemas';

export function ProfilePage() {
  const profile = useProfile();

  return (
    <div className="flex flex-col gap-12">
      <title>{pageTitle('회원정보')}</title>
      {profile.isPending ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : profile.isError ? (
        <ErrorState onRetry={() => void profile.refetch()} />
      ) : (
        <>
          <ProfileSection profile={profile.data} />
          <EmailSection />
          <PasswordSection />
          <DeleteAccountSection />
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="border-b border-line pb-3 text-md font-medium">{title}</h2>
      {children}
    </section>
  );
}

function ProfileSection({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormInput, unknown, ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile.name,
      phone: profile.phone ?? '',
      marketingAgreed: profile.marketing_agreed_at !== null,
    },
  });

  async function onSubmit(values: ProfileValues) {
    try {
      await updateProfile(profile, values);
      await queryClient.invalidateQueries({ queryKey: qk.profile(profile.id) });
      reset({
        name: values.name,
        phone: values.phone ?? '',
        marketingAgreed: values.marketingAgreed,
      });
      toast('저장했습니다');
    } catch (error) {
      toast(rpcErrorMessage(error), 'error');
    }
  }

  return (
    <Section title="회원정보">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Field id="profile-name" label="이름" required error={errors.name?.message}>
          <Input
            id="profile-name"
            autoComplete="name"
            maxLength={40}
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
        <Field id="profile-phone" label="휴대폰 번호" error={errors.phone?.message}>
          <Input
            id="profile-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="01012345678"
            invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </Field>
        <Checkbox
          id="profile-marketing"
          label="마케팅 정보 수신 동의"
          {...register('marketingAgreed')}
        />
        <div>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            저장
          </Button>
        </div>
      </form>
    </Section>
  );
}

function EmailSection() {
  const { user } = useSession();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: user?.email ?? '' },
  });

  async function onSubmit(values: ChangeEmailValues) {
    setFailure(null);
    if (values.email === user?.email) {
      setFailure('현재 이메일과 같습니다');
      return;
    }
    try {
      await changeEmail(values.email);
      toast('확인 메일을 보냈습니다');
    } catch (error) {
      setFailure(authErrorMessage(error));
    }
  }

  return (
    <Section title="이메일">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Field id="profile-email" label="이메일" error={errors.email?.message}>
          <Input
            id="profile-email"
            type="email"
            autoComplete="email"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>
        {failure ? <FormError>{failure}</FormError> : null}
        <div>
          <Button type="submit" variant="secondary" loading={isSubmitting}>
            이메일 변경
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const { user } = useSession();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', passwordConfirm: '' },
  });

  async function onSubmit(values: ChangePasswordValues) {
    setFailure(null);
    if (!user?.email) return;
    try {
      if (!(await verifyPassword(user.email, values.currentPassword))) {
        setError('currentPassword', { message: '현재 비밀번호가 올바르지 않습니다' });
        return;
      }
      await updatePassword(values.password);
      reset();
      toast('비밀번호를 변경했습니다');
    } catch (error) {
      setFailure(authErrorMessage(error));
    }
  }

  return (
    <Section title="비밀번호 변경">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Field
          id="profile-current-password"
          label="현재 비밀번호"
          error={errors.currentPassword?.message}
        >
          <Input
            id="profile-current-password"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(errors.currentPassword)}
            {...register('currentPassword')}
          />
        </Field>
        <Field id="profile-new-password" label="새 비밀번호" error={errors.password?.message}>
          <Input
            id="profile-new-password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'profile-new-password-error' : 'profile-new-password-hint'
            }
            {...register('password')}
          />
          {errors.password ? null : (
            <p id="profile-new-password-hint" className="text-xs text-ink-muted">
              {PASSWORD_RULE}
            </p>
          )}
        </Field>
        <Field
          id="profile-new-password-confirm"
          label="새 비밀번호 확인"
          error={errors.passwordConfirm?.message}
        >
          <Input
            id="profile-new-password-confirm"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.passwordConfirm)}
            {...register('passwordConfirm')}
          />
        </Field>
        {failure ? <FormError>{failure}</FormError> : null}
        <div>
          <Button type="submit" variant="secondary" loading={isSubmitting}>
            비밀번호 변경
          </Button>
        </div>
      </form>
    </Section>
  );
}

function DeleteAccountSection() {
  const activeOrders = useActiveOrderCount();
  const [open, setOpen] = useState(false);
  const blocked = (activeOrders.data ?? 0) > 0;

  return (
    <Section title="회원 탈퇴">
      <div className="flex flex-col items-start gap-3">
        <Button
          variant="danger"
          size="sm"
          disabled={activeOrders.isPending || blocked}
          onClick={() => setOpen(true)}
        >
          회원 탈퇴
        </Button>
        {blocked ? (
          <p className="text-sm text-ink-muted">진행 중인 주문이 있어 탈퇴할 수 없습니다</p>
        ) : null}
      </div>
      <DeleteAccountDialog open={open} onClose={() => setOpen(false)} />
    </Section>
  );
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession();
  const { leave } = useAccountOutlet();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });

  function close() {
    reset();
    setFailure(null);
    onClose();
  }

  async function onSubmit(values: DeleteAccountValues) {
    setFailure(null);
    if (!user?.email) return;
    try {
      if (!(await verifyPassword(user.email, values.password))) {
        setError('password', { message: '비밀번호가 올바르지 않습니다' });
        return;
      }
      await deleteMyAccount();
    } catch (error) {
      if (rpcErrorCode(error)) {
        setFailure(rpcErrorMessage(error));
        if (rpcErrorCode(error) === 'ACTIVE_ORDERS') {
          void queryClient.invalidateQueries({ queryKey: qk.orders(user.id) });
        }
      } else {
        setFailure(authErrorMessage(error));
      }
      return;
    }
    await leave('/');
    toast('탈퇴했습니다');
  }

  return (
    <Dialog open={open} onClose={close} title="회원 탈퇴">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <p>탈퇴하면 주소록과 위시리스트가 삭제되며 되돌릴 수 없습니다.</p>
        <Field id="delete-password" label="비밀번호" error={errors.password?.message}>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>
        {failure ? <FormError>{failure}</FormError> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={close}>
            취소
          </Button>
          <Button type="submit" variant="danger" size="sm" loading={isSubmitting}>
            탈퇴
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
