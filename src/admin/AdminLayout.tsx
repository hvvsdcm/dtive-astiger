import {
  FolderTree,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Package,
  Receipt,
  Settings,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from 'react-router';
import { loginPath } from '@/app/guards';
import { cn } from '@/components/ui/cn';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { toast } from '@/components/ui/toastStore';
import { authErrorMessage, signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/session';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: '주문', icon: Receipt },
  { to: '/admin/products', label: '상품', icon: Package },
  { to: '/admin/categories', label: '카테고리', icon: FolderTree },
  { to: '/admin/customers', label: '회원', icon: Users },
  { to: '/admin/home', label: '홈 화면', icon: LayoutTemplate },
  { to: '/admin/settings', label: '설정', icon: Settings },
];

/**
 * /admin shell: sidebar from lg, top bar with a scrolling menu row below it. The route loader
 * (requireAdmin) checked access on entry; this covers sign-out or expiry while the page is open.
 */
export function AdminLayout() {
  const { session, loading } = useSession();
  const location = useLocation();
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

  if (!loading && !session && !leaving) {
    return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />;
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex h-10 shrink-0 items-center gap-3 text-sm whitespace-nowrap transition-colors lg:px-3',
      isActive ? 'text-ink lg:bg-bg' : 'text-ink-muted hover:text-ink',
    );

  return (
    <div className="min-h-svh bg-bg text-ink lg:flex">
      <meta name="robots" content="noindex, nofollow" />
      <a
        href="#admin-main"
        className="sr-only z-50 bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        본문 바로가기
      </a>

      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="sticky top-0 flex h-svh flex-col">
          <Link to="/admin" className="flex h-16 items-center gap-2 px-6" aria-label="관리자 홈">
            <Logo className="h-9" />
          </Link>
          <nav aria-label="관리자" className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="flex flex-col gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={navLinkClass}>
                    <Icon icon={item.icon} size={18} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-1 border-t border-line px-3 py-4">
            <Link
              to="/"
              className="flex h-10 items-center gap-3 px-3 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <Icon icon={Store} size={18} />
              스토어로 가기
            </Link>
            <button
              type="button"
              onClick={() => void leave()}
              className="flex h-10 items-center gap-3 px-3 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <Icon icon={LogOut} size={18} />
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-line bg-bg lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/admin" aria-label="관리자 홈">
            <Logo className="h-[30px]" />
          </Link>
          <div className="flex items-center">
            <Link
              to="/"
              aria-label="스토어로 가기"
              className="inline-flex size-10 items-center justify-center"
            >
              <Icon icon={Store} />
            </Link>
            <button
              type="button"
              onClick={() => void leave()}
              aria-label="로그아웃"
              className="inline-flex size-10 items-center justify-center"
            >
              <Icon icon={LogOut} />
            </button>
          </div>
        </div>
        <nav aria-label="관리자" className="overflow-x-auto px-4">
          <ul className="flex gap-5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center border-b text-sm whitespace-nowrap transition-colors',
                      isActive
                        ? 'border-ink text-ink'
                        : 'border-transparent text-ink-muted hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
      <ScrollRestoration />
    </div>
  );
}
