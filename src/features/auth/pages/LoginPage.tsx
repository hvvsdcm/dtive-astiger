import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { safeNext } from '@/app/guards';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/toastStore';
import {
  authErrorCode,
  authErrorMessage,
  EMAIL_NOT_CONFIRMED,
  resendSignupEmail,
  signIn,
} from '../api';
import { AuthShell, FormError } from '../components/AuthShell';
import { loginSchema, type LoginInput, type LoginValues } from '../schemas';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const [failure, setFailure] = useState<{ message: string; unconfirmedEmail?: string } | null>(
    null,
  );
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    setFailure(null);
    try {
      await signIn(values.email, values.password);
      navigate(next, { replace: true });
    } catch (error) {
      setFailure({
        message: authErrorMessage(error),
        unconfirmedEmail: authErrorCode(error) === EMAIL_NOT_CONFIRMED ? values.email : undefined,
      });
    }
  }

  async function resend(email: string) {
    setResending(true);
    try {
      await resendSignupEmail(email);
      toast('인증 메일을 보냈습니다');
    } catch (error) {
      toast(authErrorMessage(error), 'error');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell title="로그인">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Field id="login-email" label="이메일" error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>
        <Field id="login-password" label="비밀번호" error={errors.password?.message}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        {failure ? (
          <div className="flex flex-col items-start gap-1">
            <FormError>{failure.message}</FormError>
            {failure.unconfirmedEmail ? (
              <Button
                variant="ghost"
                size="sm"
                loading={resending}
                onClick={() => void resend(failure.unconfirmedEmail!)}
              >
                인증 메일 다시 보내기
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
          로그인
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="underline-offset-4 hover:underline">
          비밀번호 찾기
        </Link>
        <Link to="/signup" className="underline-offset-4 hover:underline">
          회원가입
        </Link>
      </div>
    </AuthShell>
  );
}
