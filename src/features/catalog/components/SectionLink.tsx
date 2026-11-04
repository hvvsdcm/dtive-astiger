import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { isInternalHref } from '@/lib/internalHref';

/**
 * Link stored by the admin (home sections, lookbook items): router link for paths inside this app,
 * plain content for anything else (the database rejects other values; this guards old rows).
 */
export function SectionLink({
  href,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}) {
  if (!isInternalHref(href)) return <>{children}</>;
  return (
    <Link to={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
