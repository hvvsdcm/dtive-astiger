import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { authErrorMessage, updatePassword } from '../api';
import { AuthShell, FormError } from '../components/AuthShell';
import { newPasswordSchema, PASSWORD_RULE, type NewPasswordValues } from '../schemas';
import { useAuthLinkStatus, usePasswordRecovery } from '../session';

/** How long to wait for the PASSWORD_RECOVERY event before calling the link expired (PLAN ⑩). */
const RECOVERY_WAIT_MS = 3000;

export function ResetPasswordPage() {
  const recovery = usePasswordRecovery();
  const link = useAuthLinkStatus();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), RECOVERY_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (recovery) return <NewPasswordForm />;

  // A token_hash link reports its own result; a ?code= link only ever shows up as the event.
  if (link === 'failed' || (link !== 'pending' && timedOut)) {
    return (
      <AuthShell title="비밀번호 재설정">
        <p className="text-base">링크가 만료되었습니다.</p>
        <ButtonLink to="/forgot-password" fullWidth>
          재설정 링크 다시 받기
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="비밀번호 재설정">
      <Spinner size={20} label="확인 중" />
    </AuthShell>
  );
}

function NewPasswordForm() {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  async function onSubmit(values: NewPasswordValues) {
    setFailure(null);
    try {
      await updatePassword(values.password);
      toast('비밀번호를 변경했습니다');
      navigate('/account', { replace: true });
    } catch (error) {
      setFailure(authErrorMessage(error));
    }
  }

  return (
    <AuthShell title="비밀번호 재설정">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Field id="reset-password" label="새 비밀번호" error={errors.password?.message}>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'reset-password-error' : 'reset-password-hint'}
            {...register('password')}
          />
          {errors.password ? null : (
            <p id="reset-password-hint" className="text-xs text-ink-muted">
              {PASSWORD_RULE}
            </p>
          )}
        </Field>
        <Field
          id="reset-password-confirm"
          label="새 비밀번호 확인"
          error={errors.passwordConfirm?.message}
        >
          <Input
            id="reset-password-confirm"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.passwordConfirm)}
            {...register('passwordConfirm')}
          />
        </Field>
        {failure ? <FormError>{failure}</FormError> : null}
        <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
          변경하기
        </Button>
      </form>
    </AuthShell>
  );
}
