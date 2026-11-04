import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { NavItem } from '@/config/site';
import { Drawer } from '@/components/ui/Drawer';
import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/features/auth/session';

export type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
};

const rowClass = 'flex h-12 w-full items-center justify-between label-caps text-sm';

/** Full-screen panel: first-level items, second level as accordions. */
export function MobileMenu({ open, onClose, nav }: MobileMenuProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { session } = useSession();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="left"
      title={<span className="label-caps">Menu</span>}
    >
      <nav aria-label="모바일 메뉴" className="px-4">
        <ul className="border-b border-line">
          {nav.map((item) => {
            const isOpen = expanded === item.href;
            return (
              <li key={item.href} className="border-t border-line first:border-t-0">
                {item.children?.length ? (
                  <>
                    <button
                      type="button"
                      className={rowClass}
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : item.href)}
                    >
                      {item.label}
                      <Icon icon={isOpen ? Minus : Plus} size={16} />
                    </button>
                    {isOpen ? (
                      <ul className="pb-3">
                        <li>
                          <Link
                            to={item.href}
                            onClick={onClose}
                            className="flex h-10 items-center text-sm"
                          >
                            전체
                          </Link>
                        </li>
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              to={child.href}
                              onClick={onClose}
                              className="flex h-10 items-center text-sm"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <Link to={item.href} onClick={onClose} className={rowClass}>
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        <ul className="py-4">
          <li>
            <Link
              to={session ? '/account' : '/login'}
              onClick={onClose}
              className="flex h-10 items-center text-sm"
            >
              {session ? '마이페이지' : '로그인'}
            </Link>
          </li>
          <li>
            <Link
              to="/account/wishlist"
              onClick={onClose}
              className="flex h-10 items-center text-sm"
            >
              위시리스트
            </Link>
          </li>
        </ul>
      </nav>
    </Drawer>
  );
}
