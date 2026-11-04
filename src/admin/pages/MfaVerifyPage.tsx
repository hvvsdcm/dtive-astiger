import { useLoaderData } from 'react-router';
import { verifiedTotpFactorId } from '../api';
import { MfaShell, TotpCodeForm } from '../components/MfaShell';

export type MfaVerifyData = { next: string };

/** /admin/mfa: the code from the registered authenticator app. */
export function MfaVerifyPage() {
  const { next } = useLoaderData<MfaVerifyData>();
  return (
    <MfaShell title="2단계 인증">
      <TotpCodeForm factorId={verifiedTotpFactorId} next={next} submitLabel="확인" />
    </MfaShell>
  );
}
