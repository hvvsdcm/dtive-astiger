import { data, isRouteErrorResponse } from 'react-router';

/** Throw from a loader when the requested record does not exist or is not visible (RLS → 0 rows). */
export function notFound(): never {
  throw data(null, { status: 404, statusText: 'Not Found' });
}

export function isNotFound(error: unknown): boolean {
  return isRouteErrorResponse(error) && error.status === 404;
}
