import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/toastStore';
import { authErrorMessage, resendSignupEmail, signUp } from '../api';
import { AuthShell, FormError } from '../components/AuthShell';
import { PASSWORD_RULE, signupSchema, type SignupInput, type SignupValues } from '../schemas';

const CONSENTS = ['termsAgreed', 'privacyAgreed', 'ageConfirmed', 'marketingAgreed'] as const;

export function SignupPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<SignupInput, unknown, SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      name: '',
      phone: '',
      // Unchecked boxes hold `false`; the schema requires literal `true` for the required ones.
      termsAgreed: false as unknown as true,
      privacyAgreed: false as unknown as true,
      ageConfirmed: false as unknown as true,
      marketingAgreed: false,
    },
  });
  const consents = useWatch({ control, name: CONSENTS });
  const allAgreed = consents.every(Boolean);

  function toggleAll(checked: boolean) {
    for (const name of CONSENTS) {
      setValue(name, checked as true, { shouldValidate: isSubmitted });
    }
  }

  async function onSubmit(values: SignupValues) {
    setFailure(null);
    try {
      await signUp(values);
      setSentTo(values.email);
    } catch (error) {
      setFailure(authErrorMessage(error));
    }
  }

  if (sentTo) return <SignupSent email={sentTo} />;

  const consentError =
    errors.termsAgreed?.message ?? errors.privacyAgreed?.message ?? errors.ageConfirmed?.message;

  return (
    <AuthShell title="회원가입">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Field id="signup-email" label="이메일" required error={errors.email?.message}>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>
        <Field id="signup-password" label="비밀번호" required error={errors.password?.message}>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'signup-password-error' : 'signup-password-hint'}
            {...register('password')}
          />
          {errors.password ? null : (
            <p id="signup-password-hint" className="text-xs text-ink-muted">
              {PASSWORD_RULE}
            </p>
          )}
        </Field>
        <Field
          id="signup-password-confirm"
          label="비밀번호 확인"
          required
          error={errors.passwordConfirm?.message}
        >
          <Input
            id="signup-password-confirm"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.passwordConfirm)}
            {...register('passwordConfirm')}
          />
        </Field>
        <Field id="signup-name" label="이름" required error={errors.name?.message}>
          <Input
            id="signup-name"
            autoComplete="name"
            maxLength={40}
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
        <Field id="signup-phone" label="휴대폰 번호" error={errors.phone?.message}>
          <Input
            id="signup-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="01012345678"
            invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </Field>

        <fieldset className="mt-2 flex flex-col gap-3 border-t border-line pt-5">
          <legend className="sr-only">약관 동의</legend>
          <Checkbox
            id="signup-agree-all"
            label={<span className="font-medium">전체 동의</span>}
            checked={allAgreed}
            onChange={(event) => toggleAll(event.target.checked)}
          />
          <div className="flex flex-col gap-3 pl-6">
            <ConsentRow
              checkbox={
                <Checkbox
                  id="signup-terms"
                  label="[필수] 이용약관 동의"
                  invalid={Boolean(errors.termsAgreed)}
                  {...register('termsAgreed')}
                />
              }
              href="/terms"
            />
            <ConsentRow
              checkbox={
                <Checkbox
                  id="signup-privacy"
                  label="[필수] 개인정보 수집·이용 동의"
                  invalid={Boolean(errors.privacyAgreed)}
                  {...register('privacyAgreed')}
                />
              }
              href="/privacy"
            />
            <Checkbox
              id="signup-age"
              label="[필수] 만 14세 이상입니다"
              invalid={Boolean(errors.ageConfirmed)}
              {...register('ageConfirmed')}
            />
            <Checkbox
              id="signup-marketing"
              label="[선택] 마케팅 정보 수신 동의"
              {...register('marketingAgreed')}
            />
          </div>
          {consentError ? <p className="text-xs text-danger">{consentError}</p> : null}
        </fieldset>

        {failure ? <FormError>{failure}</FormError> : null}

        <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
          가입하기
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

function ConsentRow({ checkbox, href }: { checkbox: ReactNode; href: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      {checkbox}
      <Link
        to={href}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
      >
        보기
      </Link>
    </div>
  );
}

function SignupSent({ email }: { email: string }) {
  const [resending, setResending] = useState(false);

  async function resend() {
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
    <AuthShell title="이메일을 확인하세요">
      <p className="text-base">
        <span className="font-medium">{email}</span>로 인증 메일을 보냈습니다.
      </p>
      <div className="flex flex-col gap-3">
        <ButtonLink to="/login" fullWidth>
          로그인
        </ButtonLink>
        <Button variant="secondary" fullWidth loading={resending} onClick={() => void resend()}>
          인증 메일 다시 보내기
        </Button>
      </div>
    </AuthShell>
  );
}
