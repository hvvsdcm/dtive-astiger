import { useRouteError } from 'react-router';
import { pageTitle } from '@/config/site';
import { ErrorState } from '@/components/ui/ErrorState';
import { isNotFound } from './errors';
import { NotFoundPage } from './NotFoundPage';

/** Route errorElement rendered inside the store layout. */
export function RouteError() {
  const error = useRouteError();
  if (isNotFound(error)) return <NotFoundPage />;
  if (import.meta.env.DEV) console.error(error);
  return (
    <>
      <title>{pageTitle('오류')}</title>
      <ErrorState onRetry={() => window.location.reload()} />
    </>
  );
}
