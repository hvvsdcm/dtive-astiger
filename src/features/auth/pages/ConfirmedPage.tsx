import { ButtonLink } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { AuthShell } from '../components/AuthShell';
import { useAuthLinkStatus, useSession } from '../session';

/**
 * Landing page of the signup confirmation link. With a `?code=` link GoTrue has already confirmed
 * the address before redirecting here; supabase-js also signs the user in when the link is opened
 * in the browser that signed up. A `?token_hash=` link is verified on arrival.
 */
export function ConfirmedPage() {
  const { session, loading } = useSession();
  const link = useAuthLinkStatus();

  if (link === 'failed') {
    return (
      <AuthShell title="이메일 인증">
        <p className="text-base">링크가 만료되었습니다.</p>
        <ButtonLink to="/login" fullWidth>
          로그인
        </ButtonLink>
      </AuthShell>
    );
  }

  if (loading || link === 'pending') {
    return (
      <AuthShell title="이메일 인증">
        <Spinner size={20} label="확인 중" />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="이메일 인증 완료">
      {session ? (
        <ButtonLink to="/" fullWidth>
          쇼핑 계속하기
        </ButtonLink>
      ) : (
        <ButtonLink to="/login" fullWidth>
          로그인
        </ButtonLink>
      )}
    </AuthShell>
  );
}
