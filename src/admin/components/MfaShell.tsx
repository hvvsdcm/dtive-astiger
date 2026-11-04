import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { toast } from '@/components/ui/toastStore';
import { authErrorMessage, signOut } from '@/features/auth/api';
import { AuthShell, FormError } from '@/features/auth/components/AuthShell';
import { verifyTotp } from '../api';
import { totpCodeSchema, type TotpCodeInput, type TotpCodeValues } from '../schemas';

/** TOTP screens: logo, the auth column and a sign-out link, outside the admin shell. */
export function MfaShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    setLeaving(true);
    try {
      await signOut();
    } catch (error) {
      toast(authErrorMessage(error), 'error');
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-svh bg-bg text-ink">
      <meta name="robots" content="noindex, nofollow" />
      <header className="flex h-16 items-center justify-center border-b border-line px-gutter">
        <Link to="/" aria-label="홈">
          <Logo className="h-[30px] lg:h-9" />
        </Link>
      </header>
      <main>
        <AuthShell title={title}>
          {children}
          <Button
            variant="ghost"
            size="sm"
            loading={leaving}
            onClick={() => void leave()}
            className="self-start"
          >
            로그아웃
          </Button>
        </AuthShell>
      </main>
    </div>
  );
}

/**
 * Six-digit code form. Verifies the code against `factorId` (or the id `factorId` resolves to) and
 * then opens `next`; cached queries are refetched with the new admin rights.
 */
export function TotpCodeForm({
  factorId,
  next,
  submitLabel,
}: {
  factorId: string | (() => Promise<string>);
  next: string;
  submitLabel: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TotpCodeInput, unknown, TotpCodeValues>({
    resolver: zodResolver(totpCodeSchema),
    defaultValues: { code: '' },
  });

  async function onSubmit({ code }: TotpCodeValues) {
    setFailure(null);
    try {
      await verifyTotp(typeof factorId === 'string' ? factorId : await factorId(), code);
    } catch (error) {
      setFailure(authErrorMessage(error));
      return;
    }
    await queryClient.invalidateQueries();
    navigate(next, { replace: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field id="totp-code" label="인증 코드" error={errors.code?.message}>
        <Input
          id="totp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          invalid={Boolean(errors.code)}
          {...register('code')}
        />
      </Field>
      {failure ? <FormError>{failure}</FormError> : null}
      <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
        {submitLabel}
      </Button>
    </form>
  );
}
