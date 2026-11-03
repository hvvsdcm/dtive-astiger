import { Link } from 'react-router';
import { pageTitle } from '@/config/site';

export function NotFoundPage() {
  return (
    <section className="flex flex-col items-center justify-center gap-8 px-gutter py-section text-center">
      <title>{pageTitle('404')}</title>
      <h1 className="font-display text-hero">404</h1>
      <Link to="/" className="text-sm underline underline-offset-4 hover:text-ink-muted">
        홈으로
      </Link>
    </section>
  );
}
