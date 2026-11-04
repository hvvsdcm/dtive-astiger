import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { loginPath } from '@/app/guards';
import { cn } from '@/components/ui/cn';
import { toast } from '@/components/ui/toastStore';
import { authErrorMessage, signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/session';
import type { AccountOutletContext } from '../outlet';

const TABS = [
  { to: '/account/orders', label: '주문내역' },
  { to: '/account/wishlist', label: '위시리스트' },
  { to: '/account/addresses', label: '주소록' },
  { to: '/account/profile', label: '회원정보' },
];

/** /account/* shell: tab list (left column on desktop, scrolling row on mobile) and the page. */
export function AccountLayout() {
  const { session, loading } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const context: AccountOutletContext = {
    leave: async (to) => {
      setLeaving(true);
      try {
        await signOut();
      } catch (error) {
        toast(authErrorMessage(error), 'error');
      }
      navigate(to, { replace: true });
    },
  };

  // The route loader checked the session on entry; this covers expiry or sign-out in another tab.
  if (!loading && !session && !leaving) {
    return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />;
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-gutter py-12 lg:py-16">
      <h1 className="mb-8 text-lg font-medium">마이페이지</h1>
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
        <nav aria-label="마이페이지" className="lg:w-40 lg:shrink-0">
          <ul className="-mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:flex-col lg:gap-3 lg:border-0 lg:px-0">
            {TABS.map((tab) => (
              <li key={tab.to} className="shrink-0">
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      '-mb-px flex h-11 items-center border-b text-sm whitespace-nowrap transition-colors lg:mb-0 lg:h-auto lg:border-0',
                      isActive
                        ? 'border-ink text-ink lg:underline lg:underline-offset-4'
                        : 'border-transparent text-ink-muted hover:text-ink',
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
            <li className="shrink-0 lg:mt-6">
              <button
                type="button"
                onClick={() => void context.leave('/')}
                className="-mb-px flex h-11 items-center border-b border-transparent text-sm whitespace-nowrap text-ink-muted transition-colors hover:text-ink lg:mb-0 lg:h-auto lg:border-0"
              >
                로그아웃
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet context={context} />
        </div>
      </div>
    </div>
  );
}
