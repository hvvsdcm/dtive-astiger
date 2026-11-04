import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { internalPath } from '../model';

/**
 * Link stored by the admin (home sections, lookbook items): router link for "/…" paths, new-tab
 * anchor for https URLs, plain content for anything else.
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
  const path = internalPath(href);
  if (path) {
    return (
      <Link to={path} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  if (/^https:\/\/\S+$/i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }
  return <>{children}</>;
}
