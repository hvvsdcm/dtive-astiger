import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { authErrorCode, authErrorMessage, requestPasswordReset } from '../api';
import { AuthShell, FormError } from '../components/AuthShell';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFailure(null);
    try {
      await requestPasswordReset(values.email);
    } catch (error) {
      // Same screen for unknown and known emails; only throttling is reported.
      const code = authErrorCode(error);
      if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
        setFailure(authErrorMessage(error));
        return;
      }
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="비밀번호 찾기">
        <p className="text-base">가입된 이메일이면 재설정 링크가 발송됩니다.</p>
        <ButtonLink to="/login" fullWidth>
          로그인
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="비밀번호 찾기">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Field id="forgot-email" label="이메일" error={errors.email?.message}>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>
        {failure ? <FormError>{failure}</FormError> : null}
        <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
          재설정 링크 받기
        </Button>
      </form>
      <p className="text-sm">
        <Link to="/login" className="underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}
