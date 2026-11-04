import type { ReactNode } from 'react';
import { pageTitle } from '@/config/site';

/** Narrow centred column used by every auth screen. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-[432px] flex-col gap-8 px-gutter py-16 lg:py-24">
      <title>{pageTitle(title)}</title>
      <h1 className="text-lg font-medium">{title}</h1>
      {children}
    </section>
  );
}

/** Inline form-level error (server responses), announced to screen readers. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
