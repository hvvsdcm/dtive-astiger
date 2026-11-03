import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Link, NavLink } from 'react-router';
import type { NavItem } from '@/config/site';
import { selectCount, useCart } from '@/features/cart/store';
import { cn } from '@/components/ui/cn';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { MobileMenu } from './MobileMenu';

function subscribeScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

export type HeaderProps = {
  nav: NavItem[];
  /** Transparent with white text over a full-bleed hero until the page scrolls (home only). */
  overlay?: boolean;
};

const iconButton = 'inline-flex size-10 items-center justify-center';
// Desktop-only icons: a separate class string because cn() does not resolve hidden vs inline-flex.
const desktopIconButton = 'hidden size-10 items-center justify-center lg:inline-flex';

export function Header({ nav, overlay = false }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 0,
    () => false,
  );
  const count = useCart(selectCount);
  const openCart = useCart((state) => state.open);
  const transparent = overlay && !scrolled;

  return (
    <header
      className={cn(
        'top-0 z-40 h-header w-full border-b transition-colors duration-200 lg:h-header-lg',
        overlay ? 'fixed' : 'sticky',
        transparent ? 'border-transparent bg-transparent text-white' : 'border-line bg-bg text-ink',
      )}
    >
      <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center px-gutter">
        <div className="flex items-center">
          <button
            type="button"
            className={cn(iconButton, '-ml-2 lg:hidden')}
            aria-label="메뉴 열기"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Icon icon={Menu} />
          </button>
          <nav aria-label="주 메뉴" className="hidden lg:block">
            <ul className="flex items-center gap-6">
              {nav.map((item) => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        'text-sm label-caps underline-offset-4 hover:underline',
                        isActive && 'underline',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Link to="/" className="flex justify-center">
          <Logo className="h-[30px] lg:h-9" />
        </Link>

        <div className="-mr-2 flex items-center justify-end">
          <Link to="/search" className={iconButton} aria-label="검색">
            <Icon icon={Search} />
          </Link>
          <Link to="/login" className={desktopIconButton} aria-label="계정">
            <Icon icon={User} />
          </Link>
          <Link to="/account/wishlist" className={desktopIconButton} aria-label="위시리스트">
            <Icon icon={Heart} />
          </Link>
          <button
            type="button"
            className={cn(iconButton, 'relative')}
            aria-label={`장바구니, ${count}개`}
            onClick={openCart}
          >
            <Icon icon={ShoppingBag} />
            {count > 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-1 right-0.5 min-w-3 text-center text-2xs font-medium"
              >
                {count}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} nav={nav} />
    </header>
  );
}
